use std::future::{Future, poll_fn};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use std::task::{Context, Poll, Wake, Waker};
use uffda_runtime::evaluate::{Evaluation, HostCompletion, StepStatus};
use uffda_runtime::value::{HostCallable, Value};

struct WakeCounter(AtomicUsize);

impl Wake for WakeCounter {
    fn wake(self: Arc<Self>) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }

    fn wake_by_ref(self: &Arc<Self>) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

#[test]
// req:runtime-core-013
fn public_host_request_can_return_its_rooted_composite_argument() {
    let expression = serde_json::from_str(
        r#"{"kind":"invocation","expression":{"kind":"reference","name":"host"},
        "args":[{"kind":"value","value":{"items":[1,2],"name":"retained"}}]}"#,
    )
    .unwrap();
    let mut evaluation = Evaluation::with_hosts(
        expression,
        vec![HostCallable {
            id: 7,
            name: "host".into(),
            arity: 1,
        }],
    );
    let mut suspended = false;
    for _ in 0..1_000 {
        match evaluation.step_status().unwrap() {
            StepStatus::Suspended => {
                suspended = true;
                break;
            }
            StepStatus::Complete => panic!("the host must be invoked"),
            StepStatus::Yielded => {}
        }
    }
    assert!(suspended, "host invocation must reach a request");
    let request = evaluation
        .take_host_request()
        .expect("external host request");
    let identity = evaluation
        .read(&request.arguments[0], |value| match value {
            Value::Object(object) => uffda_heap::Gc::as_ptr(object) as usize,
            _ => panic!("expected the original composite argument"),
        })
        .unwrap();
    evaluation.collect();
    evaluation
        .complete_host(
            &request,
            Ok(HostCompletion::Rooted(request.arguments[0].clone())),
        )
        .unwrap();
    let result = evaluation.finish().unwrap();
    let result_identity = evaluation
        .read(&result, |value| match value {
            Value::Object(object) => uffda_heap::Gc::as_ptr(object) as usize,
            _ => panic!("expected the completed composite value"),
        })
        .unwrap();
    assert_eq!(result_identity, identity);
    let serialized = evaluation.serialize_rooted(&result).unwrap();
    assert_eq!(
        evaluation
            .read(&serialized, |value| match value {
                Value::String(text) => (*text).clone(),
                _ => panic!("expected serialized text"),
            })
            .unwrap(),
        r#"{"items":[1,2],"name":"retained"}"#
    );
}

#[test]
// req:runtime-core-013
fn public_future_driver_completes_after_an_actual_pending_host_future() {
    let expression = serde_json::from_str(
        r#"{"kind":"invocation","expression":{"kind":"reference","name":"host"},
        "args":[{"kind":"value","value":[1,2,3]}]}"#,
    )
    .unwrap();
    let mut evaluation = Evaluation::with_hosts(
        expression,
        vec![HostCallable {
            id: 7,
            name: "host".into(),
            arity: 1,
        }],
    );
    let wake_counter = Arc::new(WakeCounter(AtomicUsize::new(0)));
    let waker = Waker::from(wake_counter.clone());
    let mut context = Context::from_waker(&waker);
    let mut driver = Box::pin(evaluation.drive(|evaluation, request| {
        evaluation.collect();
        async move {
            let mut first = true;
            poll_fn(move |context| {
                if first {
                    first = false;
                    context.waker().wake_by_ref();
                    Poll::Pending
                } else {
                    Poll::Ready(Ok(HostCompletion::Rooted(request.arguments[0].clone())))
                }
            })
            .await
        }
    }));
    let mut result = None;
    for _ in 0..1_000 {
        let wakes_before = wake_counter.0.load(Ordering::SeqCst);
        match driver.as_mut().poll(&mut context) {
            Poll::Ready(value) => {
                result = Some(value.unwrap());
                break;
            }
            Poll::Pending => {
                assert!(
                    wake_counter.0.load(Ordering::SeqCst) > wakes_before,
                    "this host fixture explicitly wakes on each Pending"
                );
            }
        }
    }
    drop(driver);
    let result = result.expect("driver must complete within the fixture's step budget");
    let serialized = evaluation.serialize_rooted(&result).unwrap();
    assert_eq!(
        evaluation
            .read(&serialized, |value| match value {
                Value::String(text) => (*text).clone(),
                _ => panic!("expected serialized text"),
            })
            .unwrap(),
        "[1,2,3]"
    );
}

#[test]
// req:runtime-core-014
fn public_input_driver_is_lazy_and_suspends_before_delivering_a_composite() {
    use uffda_runtime::evaluate::{ExternalCompletion, ExternalRequest};
    use uffda_runtime::runtime::Runtime;
    use uffda_runtime::runtime::input::{InputCompletion, Source};
    let mut runtime = Runtime::pattern_from_source(
        serde_json::from_str(r#"{"kind":"any"}"#).unwrap(),
        Source {
            id: 41,
            name: "records".into(),
        },
    );
    let requests = Arc::new(AtomicUsize::new(0));
    let observed = requests.clone();
    let wakes = Arc::new(WakeCounter(AtomicUsize::new(0)));
    let waker = Waker::from(wakes.clone());
    let mut context = Context::from_waker(&waker);
    let mut driver = Box::pin(runtime.drive_external(move |runtime, request| {
        let ExternalRequest::Input(request) = request else {
            panic!("no host calls");
        };
        assert_eq!(request.source.id, 41);
        assert_eq!(request.position, 0, "no read-ahead or EOF probe is needed");
        observed.fetch_add(1, Ordering::SeqCst);
        runtime.collect_all();
        async move {
            let mut pending = true;
            poll_fn(move |context| {
                if pending {
                    pending = false;
                    context.waker().wake_by_ref();
                    Poll::Pending
                } else {
                    Poll::Ready(ExternalCompletion::Input(Ok(InputCompletion::Item(
                        HostCompletion::materialize(vec![], |mc, _| {
                            Ok(Value::object(
                                mc,
                                vec![("answer".into(), Value::Number(42.0))],
                            ))
                        }),
                    ))))
                }
            })
            .await
        }
    }));
    assert_eq!(requests.load(Ordering::SeqCst), 0);
    let mut complete = false;
    for _ in 0..1_000 {
        if let Poll::Ready(result) = driver.as_mut().poll(&mut context) {
            result.unwrap();
            complete = true;
            break;
        }
    }
    assert!(complete);
    drop(driver);
    assert_eq!(requests.load(Ordering::SeqCst), 1);
    assert!(wakes.0.load(Ordering::SeqCst) > 0);
    runtime.collect_all();
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.end, 1);
        let Value::Object(object) = result.value.raw() else {
            panic!("expected rich value");
        };
        assert!(
            object
                .borrow()
                .get("answer")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
    });
}
