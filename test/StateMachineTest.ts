import { TestStateMachine } from './TestStateMachine';
import { TestState } from './TestState';
import { TestTrigger } from './TestTrigger';
import { TestStateHandler } from "./TestStateHandler";

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// @ts-ignore
chaiUse(chaiAsPromised);

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
    const logs = sut.context().logs;
    expect(logs).to.eql([
      'entering 1',
      'exiting 1',
      'entering 2',
      'exiting 2',
      'entering 3',
    ]);
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
    sut.context().guard = true;

    await sut.start();

    expect(sut.getCurrentState()).to.equal(TestState.State3);
    const logs = sut.context().logs;
    expect(logs).to.eql([
      'entering 1',
      'exiting 1',
      'entering 3',
    ]);
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
    let invalidState: TestState | undefined;
    let invalidTrigger: TestTrigger | undefined;
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
    await sut.trigger(TestTrigger.Success);

    expect(invalidState).to.equal(TestState.State1);
    expect(invalidTrigger).to.equal(TestTrigger.UnexpectedTrigger);
    expect(sut.getCurrentState()).to.equal(TestState.State2);
  });

  it('should use transition listener', async () => {
    let transitionTrigger: TestTrigger | undefined;
    let sourceState: TestState | undefined;
    let targetState: TestState | undefined;
    const sut = new TestStateMachine(sm => {
      sm
        .withTransitionListener((trigger, source, target) => {
          transitionTrigger = trigger;
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

    expect(transitionTrigger).to.equal(TestTrigger.Success);
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
    let logs = sut1.context().logs;
    expect(logs).to.eql([
      'entering 1',
      'exiting 1',
      'entering 2'
    ]);

    // Now create a new instance and give it the context of the first state machine
    const contextJson = JSON.stringify(sut1.context());
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
    logs = sut2.context().logs;
    expect(logs).to.eql([
      'entering 1',
      'exiting 1',
      'entering 2',
      'exiting 2',
      'entering 3'
    ]);
  });

  it('should handle state without guards', async () => {
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1, TestTrigger.Success));
    });
    await expect(sut.start()).to.be.rejectedWith('Trigger Success is not valid on state State1');
  });

  it('should handle state without handler', async () => {
    // Create first state machine instance and run it from state1 to state2
    const sut1 = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .on(TestTrigger.Success).goesTo(TestState.State2);
    });
    await expect(sut1.start()).to.be.rejectedWith('No handler for state State1');
  });

  it('should throw if trigger has first target state and then executing code', async () => {
    expect(() => {
      const sut = new TestStateMachine(sm => {
        sm.state(TestState.State1)
          .isInitialState()
          .handledBy(new TestStateHandler(1))
          .on(TestTrigger.ExecuteCode).goesTo(TestState.Failed)
          .on(TestTrigger.ExecuteCode).execute(context => {
            return Promise.resolve();
          });
      });
    }).to.throw('A trigger cannot both have a target state and code that should be executed');
  });

  it('should throw if trigger has first executing code and then target state', async () => {
    expect(() => {
      const sut = new TestStateMachine(sm => {
        sm.state(TestState.State1)
          .isInitialState()
          .handledBy(new TestStateHandler(1))
          .on(TestTrigger.ExecuteCode).execute(context => {
            return Promise.resolve();
          })
          .on(TestTrigger.ExecuteCode).goesTo(TestState.Failed)
      });
    }).to.throw('A trigger cannot both have a target state and code that should be executed');
  });

  it('should throw if trigger has first executing code and then ignore', async () => {
    expect(() => {
      const sut = new TestStateMachine(sm => {
        sm.state(TestState.State1)
          .isInitialState()
          .handledBy(new TestStateHandler(1))
          .on(TestTrigger.ExecuteCode).execute(context => {
            return Promise.resolve();
          })
          .on(TestTrigger.ExecuteCode).ignore()
      });
    }).to.throw('A trigger cannot both be ignored and have code that should be executed');
  });

  it('should throw if state has first guarded target, then unguarded', async () => {
    expect(() => {
      const sut = new TestStateMachine(sm => {
        sm.state(TestState.State1)
          .isInitialState()
          .handledBy(new TestStateHandler(1))
          .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2)
          .on(TestTrigger.Success).goesTo(TestState.State3);
      });
    }).to.throw('Trigger Success on state State1 is already used with a guard, cannot also be used unguarded');
  });

  it('should throw if state has first unguarded target, then guarded', async () => {
    expect(() => {
      const sut = new TestStateMachine(sm => {
        sm.state(TestState.State1)
          .isInitialState()
          .handledBy(new TestStateHandler(1))
          .on(TestTrigger.Success).goesTo(TestState.State3)
          .on(TestTrigger.Success, context => !context.guard).goesTo(TestState.State2);
      });
    }).to.throw('Trigger Success on state State1 is already used without a guard, cannot also be used guarded');
  });

  it('should throw on no initial state', async () => {
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Success).goesTo(TestState.State3);
    });

    await expect(sut.start()).to.be.rejectedWith('Cannot determine initial state');
  });

  it('should use default triggers', async () => {
    const sut = new TestStateMachine(sm => {
      sm.default()
        .on(TestTrigger.Reset).goesTo(TestState.State1);

      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State2);

      sm.state(TestState.State2)
        .handledBy(new TestStateHandler(2))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));

    });
    await sut.start();
    await sut.trigger(TestTrigger.Success);
    await sut.trigger(TestTrigger.Reset);

    expect(sut.context().logs).to.eql([
      'entering 1',
      'exiting 1',
      'entering 2',
      'exiting 2',
      'entering 1'
    ])
  });

  it('should prioritize state trigger over default trigger', async () => {
    const sut = new TestStateMachine(sm => {
      sm.default()
        .on(TestTrigger.Reset).goesTo(TestState.State1);

      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State2);

      sm.state(TestState.State2)
        .handledBy(new TestStateHandler(2))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Reset).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));

    });
    await sut.start();
    await sut.trigger(TestTrigger.Success);
    await sut.trigger(TestTrigger.Reset);

    expect(sut.context().logs).to.eql([
      'entering 1',
      'exiting 1',
      'entering 2',
      'exiting 2',
      'entering 3'
    ])
  });


  it('should ignore trigger', async () => {
    const sut = new TestStateMachine(sm => {
      sm.state(TestState.State1)
        .isInitialState()
        .handledBy(new TestStateHandler(1))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Success).goesTo(TestState.State2)
        .on(TestTrigger.Reset).ignore();

      sm.state(TestState.State2)
        .handledBy(new TestStateHandler(2))
        .on(TestTrigger.Failure).goesTo(TestState.Failed)
        .on(TestTrigger.Reset).goesTo(TestState.State3);

      sm.state(TestState.State3).handledBy(new TestStateHandler(3));

    });
    await sut.start();

    await sut.trigger(TestTrigger.Reset);
    expect(sut.getCurrentState()).to.equal(TestState.State1);

    await sut.trigger(TestTrigger.Success);
    expect(sut.getCurrentState()).to.equal(TestState.State2);
  });

});
