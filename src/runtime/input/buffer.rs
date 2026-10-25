use crate::value::Value;
use uffda_heap::{Collect, Gc, Mutation};

/// Immutable input snapshots; external delivery shares untouched tree branches.
#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub enum InputBuffer<'gc> {
    Fixed(Gc<'gc, Vec<Value<'gc>>>),
    Growing(Prefix<'gc>),
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct Prefix<'gc> {
    root: Option<Gc<'gc, Node<'gc>>>,
    len: usize,
    height: u32,
}

#[derive(Collect)]
#[collect(no_drop)]
enum Node<'gc> {
    Item(Value<'gc>),
    Branch {
        left: Gc<'gc, Self>,
        right: Option<Gc<'gc, Self>>,
    },
}

impl<'gc> From<Gc<'gc, Vec<Value<'gc>>>> for InputBuffer<'gc> {
    fn from(value: Gc<'gc, Vec<Value<'gc>>>) -> Self {
        Self::Fixed(value)
    }
}

impl<'gc> InputBuffer<'gc> {
    pub fn empty() -> Self {
        Self::Growing(Prefix {
            root: None,
            len: 0,
            height: 0,
        })
    }

    pub fn len(self) -> usize {
        match self {
            Self::Fixed(values) => values.len(),
            Self::Growing(prefix) => prefix.len,
        }
    }

    pub fn is_empty(self) -> bool {
        self.len() == 0
    }

    pub fn get(&self, index: usize) -> Option<&Value<'gc>> {
        match self {
            Self::Fixed(values) => values.get(index),
            Self::Growing(prefix) => {
                if index >= prefix.len {
                    return None;
                }
                let mut node = prefix.root?;
                let mut height = prefix.height;
                loop {
                    match Gc::as_ref(node) {
                        Node::Item(value) => return Some(value),
                        Node::Branch { left, right } => {
                            height -= 1;
                            node = if index & (1usize << height) == 0 {
                                *left
                            } else {
                                right.expect("existing prefix position")
                            };
                        }
                    }
                }
            }
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &Value<'gc>> {
        (0..self.len()).map(|index| self.get(index).expect("existing prefix position"))
    }

    pub fn last(&self) -> Option<&Value<'gc>> {
        self.len().checked_sub(1).and_then(|index| self.get(index))
    }

    pub(crate) fn append(self, mc: &Mutation<'gc>, value: Value<'gc>) -> Self {
        let Self::Growing(prefix) = self else {
            panic!("only external input prefixes may append");
        };
        let len = prefix
            .len
            .checked_add(1)
            .expect("input prefix length overflow");
        let item = Gc::new(mc, Node::Item(value));
        let (root, height) = match prefix.root {
            None => (item, 0),
            Some(root) if prefix.len.is_power_of_two() => {
                let right = path(mc, prefix.height, item);
                (
                    Gc::new(
                        mc,
                        Node::Branch {
                            left: root,
                            right: Some(right),
                        },
                    ),
                    prefix.height + 1,
                )
            }
            Some(root) => (
                insert(mc, root, prefix.height, prefix.len, item),
                prefix.height,
            ),
        };
        Self::Growing(Prefix {
            root: Some(root),
            len,
            height,
        })
    }

    pub fn same_storage(self, other: Self) -> bool {
        match (self, other) {
            (Self::Fixed(left), Self::Fixed(right)) => Gc::ptr_eq(left, right),
            (Self::Growing(left), Self::Growing(right)) => {
                left.len == right.len
                    && match (left.root, right.root) {
                        (None, None) => true,
                        (Some(left), Some(right)) => Gc::ptr_eq(left, right),
                        _ => false,
                    }
            }
            _ => false,
        }
    }
}

fn path<'gc>(mc: &Mutation<'gc>, height: u32, mut item: Gc<'gc, Node<'gc>>) -> Gc<'gc, Node<'gc>> {
    for _ in 0..height {
        item = Gc::new(
            mc,
            Node::Branch {
                left: item,
                right: None,
            },
        );
    }
    item
}

fn insert<'gc>(
    mc: &Mutation<'gc>,
    node: Gc<'gc, Node<'gc>>,
    height: u32,
    index: usize,
    item: Gc<'gc, Node<'gc>>,
) -> Gc<'gc, Node<'gc>> {
    let Node::Branch { left, right } = *node else {
        unreachable!("append descends through branches");
    };
    let child_height = height - 1;
    if index & (1usize << child_height) == 0 {
        Gc::new(
            mc,
            Node::Branch {
                left: insert(mc, left, child_height, index, item),
                right,
            },
        )
    } else {
        let right = match right {
            Some(right) => insert(mc, right, child_height, index, item),
            None => path(mc, child_height, item),
        };
        Gc::new(
            mc,
            Node::Branch {
                left,
                right: Some(right),
            },
        )
    }
}

impl<'gc> std::ops::Index<usize> for InputBuffer<'gc> {
    type Output = Value<'gc>;
    fn index(&self, index: usize) -> &Self::Output {
        self.get(index).expect("input index out of bounds")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:runtime-core-014 req:runtime-memory-002
    fn append_allocation_is_logarithmic_and_collection_keeps_linear_storage() {
        let mut arena = uffda_heap::Arena::<uffda_heap::Rootable![InputBuffer<'_>]>::new(|_| {
            InputBuffer::empty()
        });
        for index in 0usize..4097 {
            let before = arena.metrics().total_gc_count();
            arena.mutate_root(|mc, input| {
                *input = input.append(mc, Value::Number(index as f64));
            });
            let allocated = arena.metrics().total_gc_count() - before;
            let max_nodes = if index == 0 {
                1
            } else {
                index.ilog2() as usize + 2
            };
            assert!(
                allocated <= max_nodes,
                "{allocated} allocated for append {index}, limit {max_nodes}"
            );
        }
        arena.finish_cycle();
        assert!(arena.metrics().total_gc_count() <= 2 * 4097 + usize::BITS as usize);
        arena.mutate(|_, input| {
            for index in 0..input.len() {
                assert!(input[index].strict_eq(Value::Number(index as f64)));
            }
        });
    }

    #[test]
    // req:runtime-core-014 req:runtime-memory-002
    fn old_snapshot_keeps_its_item_but_does_not_retain_a_later_cycle() {
        use crate::value::ObjectProperties;
        use uffda_heap::{Arena, GcWeak, RefLock, Rootable};
        let mut arena = Arena::<
            Rootable![(
                InputBuffer<'_>,
                Option<InputBuffer<'_>>,
                Option<GcWeak<'_, RefLock<ObjectProperties<'_>>>>
            )],
        >::new(|mc| {
            let prefix = InputBuffer::empty().append(mc, Value::Number(1.0));
            let cycle = Value::object(mc, vec![]);
            let Value::Object(object) = cycle else {
                unreachable!()
            };
            object.borrow_mut(mc).set("self".into(), cycle);
            (
                prefix,
                Some(prefix.append(mc, cycle)),
                Some(Gc::downgrade(object)),
            )
        });
        arena.finish_cycle();
        arena.mutate(|mc, (old, current, weak)| {
            assert_eq!(old.len(), 1);
            assert_eq!(current.unwrap().len(), 2);
            assert!(old.get(1).is_none());
            assert!(weak.unwrap().upgrade(mc).is_some());
        });
        arena.mutate_root(|_, (_, current, _)| *current = None);
        arena.finish_cycle();
        arena.mutate(|mc, (old, _, weak)| {
            assert!(old[0].strict_eq(Value::Number(1.0)));
            assert!(weak.unwrap().upgrade(mc).is_none());
        });
    }

    #[test]
    // req:runtime-core-014
    fn fixed_input_preserves_storage_identity_and_empty_boundaries() {
        uffda_heap::rootless_mutate(|mc| {
            let values = Gc::new(mc, vec![Value::Number(3.0)]);
            let fixed = InputBuffer::from(values);
            assert!(fixed.same_storage(values.into()));
            assert!(!fixed.same_storage(InputBuffer::empty()));
            assert!(fixed.last().unwrap().strict_eq(Value::Number(3.0)));
            assert!(InputBuffer::empty().last().is_none());
            assert!(InputBuffer::empty().iter().next().is_none());
        });
    }

    #[test]
    // req:runtime-core-014
    fn snapshots_share_branches_and_preserve_all_values_at_tree_boundaries() {
        uffda_heap::rootless_mutate(|mc| {
            let mut input = InputBuffer::empty();
            let mut snapshots = Vec::new();
            for index in 0usize..4097 {
                if index.is_power_of_two() {
                    snapshots.push(input);
                }
                input = input.append(mc, Value::Number(index as f64));
                assert_eq!(input.len(), index + 1);
                assert!(input.get(index + 1).is_none());
                assert!(input[index].strict_eq(Value::Number(index as f64)));
            }
            for snapshot in snapshots {
                for (index, value) in snapshot.iter().enumerate() {
                    assert!(value.strict_eq(Value::Number(index as f64)));
                }
            }
        });
    }
}
