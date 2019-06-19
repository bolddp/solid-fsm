# solid-fsm
A strongly typed Promise based Finite State Machine with a simple, fluent API.

## Installation

TBD : Publish to NPM

## Usage

An FSM can provide a nice solution when building an application whose logic flow depends on well defined events (triggers). The states also become self-sufficient since they have no idea about the other states, they can themselves only signal progress through triggers.

### Let's use an old-style telephone as an example. Its possible states are as follows:
* Idle - telephone is not in use
* Dialling - the user has picked up the handset and is dialling a number
* Waiting for answer - the user has dialled the number but has not yet gotten an answer
* Ringing - a call has been received but the user has not yet answered
* Line busy - the line is busy
* Conversation - the two parts in the phone call are talking
* Line disconnected - the call has ended but the handset is still off the hook

### The triggers (events that can occur) are the following:
* Picking up the phone - the handset is picked up by the user
* Incoming call
* Ignore incoming call - the user decides not to answer
* Finished dialling
* Answered - the other part in the call answers the phone
* User hanging up - the user put down the handset
* Other part hanging up - the other part in the call put down the headset

### So, let's create this telephone using solid-fsm
```ts
// Available states (as strings to make logging etc. prettier)
enum State {
  Idle = 'Idle',
  Dialling = 'Dialling',
  WaitingForAnswer = 'WaitingForAnswer',
  Ringing = 'Ringing',
  LineBusy = 'LineBusy',
  Conversation = 'Conversation',
  LineDisconnected = 'LineDisconnected'
}

// Available triggers (also strings)
enum Trigger {
  PickedUpPhone = 'PickedUpPhone',
  IncomingCall = 'IncomingCall',
  FinishedDialling = 'FinishedDialling',
  Answered = 'Answered',
  UserHungUp = 'UserHungUp',
  OtherPartHungUp = 'OtherPartHungUp'
}

// The telephone context. Since the states aren't aware of eachother and have no means
// of interacting directly, the context can be used to share data between them. It also
// holds the current state of the state machine, which means that a state machine can
// be re-instantiated with a context from a previous instance and then continue in the
// state that it had before.
class Context implements StateMachineContext<State> {
  state: State;
  isLineBusy: boolean;
}

// State handlers, that are separate classes that contain logic for when a state is
// entered or exited. The handler for the Ringing state could look like this.
class RingingHandler implements StateHandler<Trigger, Context> {
  bell: Bell;
  constructor(bell: Bell) {
    this.bell = bell;
  }
  entering(trigger: (trigger: Trigger) => Promise<void>, context: Context): Promise<void> {
    return this.bell.start();
  }
  exiting(): Promise<void> {
    return this.bell.stop();
  }
}
// ... other handlers omitted for brevity

// And finally we compose these components into a full fledged telephone FSM by subclassing
// the StateMachine class.
export class TelephoneSm extends StateMachine<State, Trigger, Context> {
  constructor() {
    super(new Context());
    this.configure();
  }

  configure() {
    this.state(State.Idle).handledBy(new IdleHandler())
      .isInitialState()
      .on(Trigger.PickedUpPhone).goesTo(State.Dialling)
      .on(Trigger.IncomingCall).goesTo(State.Ringing);

    this.state(State.Ringing).handledBy(new RingingHandler())
      .on(Trigger.PickedUpPhone).goesTo(State.Conversation)
      .on(Trigger.OtherPartHungUp).goesTo(State.Idle);

    this.state(State.Dialling).handledBy(new DiallingHandler())
      .on(Trigger.FinishedDialling, ctx => ctx.isLineBusy).goesTo(State.LineBusy)
      .on(Trigger.FinishedDialling, ctx => !ctx.isLineBusy).goesTo(State.WaitingForAnswer)
      .on(Trigger.UserHungUp).goesTo(State.Idle);

    this.state(State.LineBusy).handledBy(new LineBusyHandler())
      .on(Trigger.UserHungUp).goesTo(State.Idle);

    this.state(State.WaitingForAnswer).handledBy(new WaitForAnswerHandler())
      .on(Trigger.Answered).goesTo(State.Conversation)
      .on(Trigger.UserHungUp).goesTo(State.Idle);

    this.state(State.Conversation).handledBy(new ConversationHandler())
      .on(Trigger.UserHungUp).goesTo(State.Idle)
      .on(Trigger.OtherPartHungUp).goesTo(State.LineDisconnected);

    this.state(State.LineDisconnected).handledBy(new LineDisconnected())
      .on(Trigger.UserHungUp).goesTo(State.Idle);
  }
}

// And then we make use of our new telephone in a fancy async fashion

const t = new TelephoneSm();
await t.start();
// State -> Idle
await t.trigger(Trigger.IncomingCall);
// State -> Ringing
await t.trigger(Trigger.PickedUpPhone);
// State -> Conversation

// Invalid triggers are NOT OK
await t.trigger(Trigger.IncomingCall);
// Error: Trigger IncomingCall is not valid on state Conversation
await t.trigger(Trigger.UserHungUp);
// State -> Idle
```

### Handling invalid triggers
If you don't want an error to be thrown if an invalid trigger is fired, you can provide your own custom handler.

```ts
this
  .withInvalidTriggerListener(async (state: State, trigger: Trigger) => {
    console.log(`Invalid trigger on state ${state}: ${trigger}`);
  })
  .state(State.Idle).handledBy(new IdleHandler())
  ...

```

### Tracking transitions
Transitions, when the state machine exits one state and enters the next, can be convenient to track and log. You can provide your own handler for that, too.
```ts
this
  .withTransitionListener(async (sourceState: State, targetState: State) => {
    console.log(`Transitioning: ${sourceState} -> ${targetState}`);
  })
  ...

```

### Execute code on trigger
You can also configure a state to execute code when a specific trigger is fired on a state. The state machine will execute the code but stay in the same state. Let's extend the telephone to handle a second incoming call by playing
a pre-recorded message.
```ts
this.state(State.Conversation).handledBy(new ConversationHandler())
  .on(Trigger.UserHungUp).goesTo(State.Idle)
  .on(Trigger.OtherPartHungUp).goesTo(State.LineDisconnected)
  .on(Trigger.IncomingCall).execute(async ctx => {
    this.messagePlayer.play('in_another_call.mp3');
  });
```