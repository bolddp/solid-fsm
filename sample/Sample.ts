import { StateMachineContext } from '../src/StateMachineContext';
import { StateMachine } from '../src/StateMachine';
import { StateHandler } from '../src/StateHandler';

enum State {
  Idle = 'Idle',
  Dialling = 'Dialling',
  WaitingForAnswer = 'WaitingForAnswer',
  Ringing = 'Ringing',
  LineBusy = 'LineBusy',
  Conversation = 'Conversation',
  LineDisconnected = 'LineDisconnected'
}

enum Trigger {
  PickedUpPhone = 'PickedUpPhone',
  IncomingCall = 'IncomingCall',
  FinishedDialling = 'FinishedDialling',
  Answered = 'Answered',
  UserHungUp = 'UserHungUp',
  OtherPartHungUp = 'OtherPartHungUp'
}

// A context, which holds data that can be shared between the states.
class Context implements StateMachineContext<State> {
  state: State;
  isLineBusy: boolean;
}

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

class TelephoneSm extends StateMachine<State, Trigger, Context> {
  constructor() {
    super(new Context());
    this.configure();
  }

  configure() {
    this
      .withInvalidTriggerListener(async (state: State, trigger: Trigger) => {
        console.log(`Invalid trigger on state ${state}: ${trigger}`);
      })
      .withTransitionListener(async (sourceState: State, targetState: State) => {
        console.log(`Transitioning: ${sourceState} -> ${targetState}`);
      })
      .state(State.Idle).handledBy(new IdleHandler())
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
      .on(Trigger.OtherPartHungUp).goesTo(State.LineDisconnected)
      .on(Trigger.IncomingCall).execute(async ctx => {
        this.messagePlayer.play('in_another_call.mp3');
      });

    this.state(State.LineDisconnected).handledBy(new LineDisconnected())
      .on(Trigger.UserHungUp).goesTo(State.Idle);

  }
}

const usePhone = async () => {
  const t = new TelephoneSm();
  await t.start();
  // State -> Idle
  await t.trigger(Trigger.IncomingCall);
  // State -> Ringing
  await t.trigger(Trigger.PickedUpPhone);
  // Start -> Conversation
  // Invalid triggers are NOT OK
  await t.trigger(Trigger.IncomingCall);
  // Error: Trigger IncomingCall is not valid on state Conversation
  await t.trigger(Trigger.UserHungUp);
  // State -> Idle
}