use crate::environment::Environment;
use crate::value::{Object, Value};
use uffda_heap::{Arena, Collect, DynamicRootSet, Gc, GcWeak, RefLock, Rootable};

#[derive(Collect)]
#[collect(no_drop)]
struct Roots<'gc> {
    values: Vec<Value<'gc>>,
    weak_objects: Vec<GcWeak<'gc, RefLock<crate::value::ObjectProperties<'gc>>>>,
    weak_errors: Vec<GcWeak<'gc, crate::value::RuntimeErrorValue<'gc>>>,
    capture: Option<Gc<'gc, Capture<'gc>>>,
    weak_capture: Option<GcWeak<'gc, Capture<'gc>>>,
    external: DynamicRootSet<'gc>,
}

// A storage fixture, not an implementation of lambda evaluation.
#[derive(Collect)]
#[collect(no_drop)]
struct Capture<'gc> {
    environment: Environment<'gc>,
    recursive: Gc<'gc, RefLock<Option<Gc<'gc, Capture<'gc>>>>>,
}

fn arena() -> Arena<Rootable![Roots<'_>]> {
    Arena::new(|mc| Roots {
        values: vec![],
        weak_objects: vec![],
        weak_errors: vec![],
        capture: None,
        weak_capture: None,
        external: DynamicRootSet::new(mc),
    })
}

#[test]
// req:runtime-memory-001 req:runtime-memory-002 req:data-codec-003
fn codec_native_values_and_error_causes_are_traced_and_reclaimed() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let ast = serde_json::json!({
            "kind":"array",
            "items":[
                {"kind":"bigint","token":"123456789n"},
                {"kind":"tag","tag":"date","value":{"kind":"string","token":"\"1970-01-01T00:00:00Z\""}},
                {"kind":"tag","tag":"error","value":{
                    "kind":"object","entries":[
                        {"key":"name","value":{"kind":"string","token":"\"TypeError\""}},
                        {"key":"message","value":{"kind":"string","token":"\"failed\""}},
                        {"key":"cause","value":{"kind":"object","entries":[
                            {"key":"detail","value":{"kind":"boolean","value":true}}
                        ]}}
                    ]
                }}
            ]
        });
        let document = crate::codec::data::DataDocument::from_ast(
            ast,
            crate::codec::data::DataLimits::default(),
        )
        .unwrap();
        let root = document.materialize(mc);
        let Value::Array(items) = root else {
            panic!("expected array")
        };
        let items = items.borrow();
        let Value::Error(error_value) = items[2] else {
            panic!("expected Error")
        };
        let Value::Object(object) = error_value.cause.expect("error cause") else {
            panic!("expected cause object")
        };
        roots.weak_errors.push(Gc::downgrade(error_value));
        roots.weak_objects.push(Gc::downgrade(object));
        roots.values.push(root);
    });
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        let Value::Array(items) = roots.values[0] else {
            panic!("expected array")
        };
        let items = items.borrow();
        let Value::BigInt(bigint) = items[0] else {
            panic!("expected BigInt")
        };
        assert_eq!(bigint.0, num_bigint::BigInt::from(123456789));
        let Value::Date(date) = items[1] else {
            panic!("expected Date")
        };
        assert_eq!(date.0, time::OffsetDateTime::UNIX_EPOCH);
        let Value::Error(error) = items[2] else {
            panic!("expected Error")
        };
        let Value::Object(cause) = error.cause.expect("retained cause") else {
            panic!("expected cause object")
        };
        assert!(
            cause
                .borrow()
                .get("detail")
                .unwrap()
                .strict_eq(Value::Boolean(true))
        );
        assert!(roots.weak_errors[0].upgrade(mc).is_some());
        assert!(roots.weak_objects[0].upgrade(mc).is_some());
    });
    arena.mutate_root(|_, roots| roots.values.clear());
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        assert!(roots.weak_errors[0].upgrade(mc).is_none());
        assert!(roots.weak_objects[0].upgrade(mc).is_none());
    });
}

fn object(value: Value<'_>) -> Object<'_> {
    let Value::Object(object) = value else {
        panic!("expected object");
    };
    object
}

#[test]
// req:runtime-memory-001 req:runtime-memory-002
fn reachable_self_cycle_survives_and_unreachable_cycle_is_collected() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let value = Value::object(mc, vec![]);
        let object = object(value);
        object.borrow_mut(mc).set("self".into(), value);
        roots.weak_objects.push(Gc::downgrade(object));
        roots.values.push(value);
    });
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        let value = roots.values[0];
        assert!(roots.weak_objects[0].upgrade(mc).is_some());
        assert!(object(value).borrow().get("self").unwrap().strict_eq(value));
    });
    arena.mutate_root(|_, roots| roots.values.clear());
    arena.finish_cycle();
    arena.mutate(|mc, roots| assert!(roots.weak_objects[0].upgrade(mc).is_none()));
}

#[test]
// req:runtime-memory-001 req:runtime-memory-002
fn mutual_cycles_and_nested_arrays_are_traced() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let left = Value::object(mc, vec![]);
        let right = Value::object(mc, vec![]);
        object(left).borrow_mut(mc).set("right".into(), right);
        object(right).borrow_mut(mc).set("left".into(), left);
        roots
            .weak_objects
            .extend([Gc::downgrade(object(left)), Gc::downgrade(object(right))]);
        roots.values.push(Value::array(mc, vec![left]));
    });
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        assert!(
            roots
                .weak_objects
                .iter()
                .all(|weak| weak.upgrade(mc).is_some())
        );
        let Value::Array(array) = roots.values[0] else {
            panic!("expected array");
        };
        let left = array.borrow()[0];
        let right = object(left).borrow().get("right").unwrap();
        assert!(object(right).borrow().get("left").unwrap().strict_eq(left));
    });
    arena.mutate_root(|_, roots| roots.values.clear());
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        assert!(
            roots
                .weak_objects
                .iter()
                .all(|weak| weak.upgrade(mc).is_none())
        );
    });
}

#[test]
// req:runtime-memory-002 req:runtime-memory-003
fn captured_ancestors_survive_and_recursive_capture_is_reclaimed() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| {
        let value = Value::object(mc, vec![("answer".into(), Value::Number(42.0))]);
        let parent = Environment::new(mc, None, vec![("value".into(), value)]);
        let child = Environment::new(mc, Some(parent), vec![]);
        let capture = Gc::new(
            mc,
            Capture {
                environment: child,
                recursive: Gc::new(mc, RefLock::new(None)),
            },
        );
        *capture.recursive.borrow_mut(mc) = Some(capture);
        roots.capture = Some(capture);
        roots.weak_capture = Some(Gc::downgrade(capture));
        roots.weak_objects.push(Gc::downgrade(object(value)));
    });
    arena.finish_cycle();
    arena.mutate(|_, roots| {
        let capture = roots.capture.unwrap();
        let value = capture.environment.get("value").unwrap();
        assert!(
            object(value)
                .borrow()
                .get("answer")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
        assert!(Gc::ptr_eq(capture.recursive.borrow().unwrap(), capture));
    });
    arena.mutate_root(|_, roots| roots.capture = None);
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        assert!(roots.weak_capture.unwrap().upgrade(mc).is_none());
        assert!(roots.weak_objects[0].upgrade(mc).is_none());
    });
}

#[test]
// req:runtime-memory-003
fn external_handles_keep_values_alive_and_cannot_cross_arenas() {
    let mut arena = arena();
    let handle = arena.mutate_root(|mc, roots| {
        let value = Value::object(mc, vec![("answer".into(), Value::Number(42.0))]);
        roots.weak_objects.push(Gc::downgrade(object(value)));
        roots
            .external
            .stash::<Rootable![Value<'_>]>(mc, Gc::new(mc, value))
    });
    let cloned_handle = handle.clone();
    drop(handle);
    arena.finish_cycle();
    arena.mutate(|_, roots| {
        let value = *roots.external.fetch(&cloned_handle);
        assert!(
            object(value)
                .borrow()
                .get("answer")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
    });
    let other = self::arena();
    other.mutate(|_, roots| assert!(roots.external.try_fetch(&cloned_handle).is_err()));
    drop(cloned_handle);
    arena.finish_cycle();
    arena.mutate(|mc, roots| assert!(roots.weak_objects[0].upgrade(mc).is_none()));
}

#[test]
// req:runtime-memory-003
fn external_root_survives_a_suspended_future() {
    use std::future::{Future, poll_fn};
    use std::task::{Context, Poll, Waker};

    let mut arena = arena();
    let handle = arena.mutate_root(|mc, roots| {
        let value = Value::object(mc, vec![("answer".into(), Value::Number(42.0))]);
        roots.weak_objects.push(Gc::downgrade(object(value)));
        roots
            .external
            .stash::<Rootable![Value<'_>]>(mc, Gc::new(mc, value))
    });
    let mut future = Box::pin(async move {
        let mut suspended = false;
        poll_fn(|context| {
            if suspended {
                Poll::Ready(())
            } else {
                suspended = true;
                context.waker().wake_by_ref();
                Poll::Pending
            }
        })
        .await;
        handle
    });
    let mut context = Context::from_waker(Waker::noop());
    assert!(future.as_mut().poll(&mut context).is_pending());
    arena.finish_cycle();
    arena.mutate(|mc, roots| assert!(roots.weak_objects[0].upgrade(mc).is_some()));
    let Poll::Ready(handle) = future.as_mut().poll(&mut context) else {
        panic!("expected resumed future");
    };
    drop(future);
    arena.mutate(|_, roots| {
        let value = *roots.external.fetch(&handle);
        assert!(
            object(value)
                .borrow()
                .get("answer")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
    });
    drop(handle);
    arena.finish_cycle();
    arena.mutate(|mc, roots| assert!(roots.weak_objects[0].upgrade(mc).is_none()));
}

#[test]
// req:runtime-memory-002
fn repeated_collection_does_not_accumulate_unreachable_allocations() {
    let mut arena = arena();
    arena.finish_cycle();
    let baseline = arena.metrics().total_gc_count();
    for _ in 0..100 {
        arena.mutate_root(|mc, roots| {
            for _ in 0..100 {
                let value = Value::object(mc, vec![]);
                object(value).borrow_mut(mc).set("self".into(), value);
                roots.values.push(value);
            }
        });
        arena.finish_cycle();
        assert!(arena.metrics().total_gc_count() >= baseline + 100);
        arena.mutate_root(|_, roots| roots.values.clear());
        arena.finish_cycle();
        assert_eq!(arena.metrics().total_gc_count(), baseline);
    }
}

#[test]
// req:runtime-memory-001 req:runtime-memory-003
fn write_barriers_keep_new_children_alive_during_incremental_collection() {
    let mut arena = arena();
    arena.mutate_root(|mc, roots| roots.values.push(Value::object(mc, vec![])));
    arena.finish_cycle();
    // Finish marking but leave sweeping pending, then introduce a new edge.
    arena.finish_marking().unwrap().start_sweeping();
    arena.mutate_root(|mc, roots| {
        let child = Value::object(mc, vec![("answer".into(), Value::Number(42.0))]);
        object(roots.values[0])
            .borrow_mut(mc)
            .set("child".into(), child);
        roots.weak_objects.push(Gc::downgrade(object(child)));
    });
    arena.finish_cycle();
    arena.finish_cycle();
    arena.mutate(|mc, roots| {
        assert!(roots.weak_objects[0].upgrade(mc).is_some());
        let child = object(roots.values[0]).borrow().get("child").unwrap();
        assert!(
            object(child)
                .borrow()
                .get("answer")
                .unwrap()
                .strict_eq(Value::Number(42.0))
        );
    });
}
