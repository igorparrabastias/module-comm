
# @nomikos/module-google

Servicios de FCM y GCE

# Sobre redundancia con varios workers pero haciendo de a una tarea

One approach to handling failover in a case where you want redundant consumers but need to process messages in a specific order is to use the exclusive consumer option when setting up the bind to the queue, and to have two consumers who keep trying to bind even when they can't get the exclusive lock.

The process is something like this:

Consumer A starts first and binds to the queue as an exclusive consumer. Consumer A begins processing messages from the queue.
Consumer B starts next and attempts to bind to the queue as an exclusive consumer, but is rejected because the queue already has an exclusive consumer.
On a recurring basis, consumer B attempts to get an exclusive bind on the queue but is rejected.
Process hosting consumer A crashes.
Consumer B attempts to bind to the queue as an exclusive consumer, and succeeds this time. Consumer B starts processing messages from the queue.
Consumer A is brought back online, and attempts an exclusive bind, but is rejected now.
Consumer B continues to process messages in FIFO order.
While this approach doesn't provide load sharing, it does provide redundancy.

### Exclusive Queues
An exclusive queue can only be used (consumed from, purged, deleted, etc) by its declaring connection. An attempt to use an exclusive queue from a different connection will result in a channel-level exception RESOURCE_LOCKED with an error message that says cannot obtain exclusive access to locked queue.

Exclusive queues are deleted when their declaring connection is closed or gone (e.g. due to underlying TCP connection loss). They therefore are only suitable for client-specific transient state.

It is common to make exclusive queues server-named.

### Single Active Consumer
Single active consumer allows to have only one consumer at a time consuming from a queue and to fail over to another registered consumer in case the active one is cancelled or dies. Consuming with only one consumer is useful when messages must be consumed and processed in the same order they arrive in the queue.

A typical sequence of events would be the following:

A queue is declared and some consumers register to it at roughly the same time.
The very first registered consumer become the single active consumer: messages are dispatched to it and the other consumers are ignored.
The single active consumer is cancelled for some reason or simply dies. One of the registered consumer becomes the new single active consumer and messages are now dispatched to it. In other terms, the queue fails over automatically to another consumer.
Note that without the single active consumer feature enabled, messages would be dispatched to all consumers using round-robin.

Single active consumer can be enabled when declaring a queue, with the x-single-active-consumer argument set to true, e.g. with the Java client:

Channel ch = ...;
Map<String, Object> arguments = new HashMap<String, Object>();
arguments.put("x-single-active-consumer", true);
ch.queueDeclare("my-queue", false, false, false, arguments);
Compared to AMQP exclusive consumer, single active consumer puts less pressure on the application side to maintain consumption continuity. Consumers just need to be registered and failover is handled automatically, there's no need to detect the active consumer failure and to register a new consumer.

The management UI and the CLI can report which consumer is the current active one on a queue where the feature is enabled.

Please note the following about single active consumer:

There's no guarantee on the selected active consumer, it is picked up randomly, even if consumer priorities are in use.
Trying to register a consumer with the exclusive consume flag set to true will result in an error if single active consumer is enabled on the queue.
Messages are always delivered to the active consumer, even if it is too busy at some point. This can happen when using manual acknowledgment and basic.qos, the consumer may be busy dealing with the maximum number of unacknowledged messages it requested with basic.qos. In this case, the other consumers are ignored and messages are enqueued.
It is not possible to enable single active consumer with a policy. Here is the reason why. Policies in RabbitMQ are dynamic by nature, they can come and go, enabling and disabling the features they declare. Imagine suddenly disabling single active consumer on a queue: the broker would start sending messages to inactive consumers and messages would be processed in parallel, exactly the opposite of what single active consumer is trying to achieve. As the semantics of single active consumer do not play well with the dynamic nature of policies, this feature can be enabled only when declaring a queue, with queue arguments.
