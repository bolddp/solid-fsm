import { expect } from 'chai';
import { TestStateMachine } from './TestStateMachine';
import { TestState } from './TestState';
import { TestTrigger } from './TestTrigger';
import { TestStateHandler } from "./TestStateHandler";

describe('StateMachine', () => {
  it('should flow through all states', async () => {
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1, TestTrigger.Success))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2, TestTrigger.Success))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));

    });
    await sut.start();

    expect(sut.getCurrentState()).to.equal(TestState.State3);
    const logs = sut.context.logs;
    expect(logs.length).to.equal(5);
    expect(logs[0]).to.equal('entering 1');
    expect(logs[1]).to.equal('exiting 1');
    expect(logs[2]).to.equal('entering 2');
    expect(logs[3]).to.equal('exiting 2');
    expect(logs[4]).to.equal('entering 3');
  });

  /**
   * Tests that the guard is respected by jumping directly from State1 to State3.
   */
  it('should skip state 2 because of guard', async () => {
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1, TestTrigger.Success))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2, TestTrigger.Success))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));
    });
    sut.context.guard = true;

    await sut.start();

    expect(sut.getCurrentState()).to.equal(TestState.State3);
    const logs = sut.context.logs;
    expect(logs.length).to.equal(3);
    expect(logs[0]).to.equal('entering 1');
    expect(logs[1]).to.equal('exiting 1');
    expect(logs[2]).to.equal('entering 3');
  });

  it('should throw error on unexpected state', async () => {
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2));
    });
    await sut.start()
      .then(() => sut.trigger(TestTrigger.UnexpectedTrigger))
      .then(() => { throw new Error('error not thrown') })
      .catch(error => expect(error.message).to.equal('Trigger UnexpectedTrigger is not valid on state State1'));
  });

  it('should use invalid trigger listener', async () => {
    let invalidState: TestState;
    let invalidTrigger: TestTrigger;
    const sut = new TestStateMachine(sm => {
      sm
        .withInvalidTriggerListener((state, trigger) => {
          invalidState = state;
          invalidTrigger = trigger;
          return Promise.resolve();
        })
        .state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2));
    });
    await sut.start();
    await sut.trigger(TestTrigger.UnexpectedTrigger);

    expect(invalidState).to.equal(TestState.State1);
    expect(invalidTrigger).to.equal(TestTrigger.UnexpectedTrigger);
  });

  it('should use transition listener', async () => {
    let sourceState: TestState;
    let targetState: TestState;
    const sut = new TestStateMachine(sm => {
      sm
        .withTransitionListener((source, target) => {
          sourceState = source;
          targetState = target;
          return Promise.resolve();
        })
        .state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2));
    });
    await sut.start();
    await sut.trigger(TestTrigger.Success);

    expect(sourceState).to.equal(TestState.State1);
    expect(targetState).to.equal(TestState.State2);
  });

  it('should execute code on trigger', async () => {
    let executed = false;
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.ExecuteCode).execute(context => {
          executed = true;
          return Promise.resolve();
        })
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2));
    });
    await sut.start();
    await sut.trigger(TestTrigger.ExecuteCode);

    expect(executed).to.equal(true);
    expect(sut.getValidTriggers()).to.include(TestTrigger.Failure);
    expect(sut.getValidTriggers()).to.include(TestTrigger.Success);
    expect(sut.getValidTriggers()).to.include(TestTrigger.ExecuteCode);
    expect(sut.getValidTriggers()).to.not.include(TestTrigger.UnexpectedTrigger);
  });

  it('should split work on two state machine instances', async () => {
    // Create first state machine instance and run it from state1 to state2
    const sut1 = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));
    });
    await sut1.start();
    await sut1.trigger(TestTrigger.Success);

    expect(sut1.getCurrentState()).to.equal(TestState.State2);
    let logs = sut1.context.logs;
    expect(logs.length).to.equal(3);
    expect(logs[0]).to.equal('entering 1');
    expect(logs[1]).to.equal('exiting 1');
    expect(logs[2]).to.equal('entering 2');

    // Now create a new instance and give it the context of the first state machine
    const contextJson = JSON.stringify(sut1.context);
    const sut2 = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
        .on(TestTrigger.Success, context => context.guard).goesTo(TestState.State3);

      sm.state(TestState.State2).handledBy(new TestStateHandler(2))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));
    }, JSON.parse(contextJson));

    await sut2.start();
    await sut2.trigger(TestTrigger.Success);

    expect(sut2.getCurrentState()).to.equal(TestState.State3);
    logs = sut2.context.logs;
    expect(logs.length).to.equal(6);
    expect(logs[0]).to.equal('entering 1');
    expect(logs[1]).to.equal('exiting 1');
    expect(logs[2]).to.equal('entering 2');
    // State 2 is entered by both state machine instances
    expect(logs[3]).to.equal('entering 2');
    expect(logs[4]).to.equal('exiting 2');
    expect(logs[5]).to.equal('entering 3');
  });

});