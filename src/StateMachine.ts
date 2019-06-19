import { StateConfiguration } from "./StateConfiguration";
import { StateMachineContext } from './StateMachineContext';

/**
 * A strongly typed Finite State Machine that transitions through a set of states. The transition
 * from one state to another is initiated by a trigger. The trigger can be fired from within the
 * current state or by the state machine reacting to external events.
 *
 * Each state in the state machine has a handler, that is called when the state is entered and exited.
 *
 * When a state machine is created, it needs to be configured. The configuration consists of defining
 * the initial state, the triggers that it should react to and then any other states that the
 * state machine can be in.
 * */
export class StateMachine<TState, TTrigger, TContext extends StateMachineContext<TState>> {
  context: TContext;
  initialState: TState;
  currentState: StateConfiguration<TState, TTrigger, TContext>;
  isProcessingList: boolean = false;
  triggerList: TTrigger[] = [];
  invalidTriggerListener: (state: TState, trigger: TTrigger) => Promise<void>;
  transitionListener: (sourceState: TState, targetState: TState) => Promise<void>

  private sc: Map<TState, StateConfiguration<TState, TTrigger, TContext>> = new Map();

  constructor(context: TContext) {
    this.context = context;
    this.trigger = this.trigger.bind(this);
  }

  private notifyTransition(sourceState: TState, targetState: TState): Promise<void> {
    if (!this.transitionListener) {
      return Promise.resolve();
    } else {
      return this.transitionListener(sourceState, targetState);
    }
  }

  private enterState(stateConfiguration: StateConfiguration<TState, TTrigger, TContext>): Promise<void> {
    this.currentState = stateConfiguration;
    this.context.state = stateConfiguration.state;
    if (!stateConfiguration.handler) {
      throw new Error(`No handler for state ${stateConfiguration.state}`);
    }
    return stateConfiguration.handler.entering(this.trigger, this.context);
  }

  private processTriggerList(): Promise<void> {
    const trigger = this.triggerList.shift();
    if (!trigger) {
      this.isProcessingList = false;
      return Promise.resolve();
    }

    // Assume that there is an unguarded trigger configuration that matches the trigger
    let triggerConfig = this.currentState.unguardedTriggerConfigurations.get(trigger);
    if (!triggerConfig) {
      // OK, then let's pick the first guarded configuration whose guard evaluates to true
      const guardedTriggers = this.currentState.guardedTriggerConfigurations.get(trigger) || [];
      triggerConfig = guardedTriggers.find(state => state.guard!(this.context));
    }
    if (!triggerConfig) {
      if (!this.invalidTriggerListener) {
        throw new Error(`Trigger ${trigger} is not valid on state ${this.currentState.state}`);
      } else {
        // There is an invalid trigger handler, let it decide what to do
        return this.invalidTriggerListener(this.currentState.state, trigger);
      }
    }
    if (triggerConfig.func) {
      return triggerConfig.func(this.context);
    } else {
      const exitingState = this.currentState.state;
      const enteringState = triggerConfig.targetStateConfiguration.state;
      return this.currentState.handler.exiting()
        .then(() => this.notifyTransition(exitingState, enteringState))
        .then(() => this.enterState(triggerConfig.targetStateConfiguration))
        .then(() => this.processTriggerList());
    }
  }

  /**
   * Fires a trigger on the state machine, causing it to transition to a new state.
   * @param trigger the trigger to fire
   */
  trigger(trigger: TTrigger): Promise<void> {
    this.triggerList.push(trigger);
    if (this.isProcessingList) {
      return Promise.resolve();
    }
    this.isProcessingList = true;
    return this.processTriggerList();
  }

  /**
   * Sets a listener for invalid triggers on the state machine. If no listener is set, the state
   * machine throws an error when an invalid state is encountered.
   * @param listener the listener that should be notified when an invalid trigger is fired
   */
  withInvalidTriggerListener(listener: (state: TState,
    trigger: TTrigger) => Promise<void>): StateMachine<TState, TTrigger, TContext> {
    this.invalidTriggerListener = listener;
    return this;
  }

  /**
   * Sets a listener that is notified when a transition occurs in the state machine.
   * @param listener the listener that should be notified when a transition occurs
   */
  withTransitionListener(listener: (sourceState: TState,
    targetState: TState) => Promise<void>): StateMachine<TState, TTrigger, TContext> {
    this.transitionListener = listener;
    return this;
  }

  /**
   * Gets or creates a state configuration and associates it with a specific state.
   */
  state(state: TState): StateConfiguration<TState, TTrigger, TContext> {
    let config = this.sc.get(state);
    if (!config) {
      config = new StateConfiguration(this, state);
      this.sc.set(state, config);
    }
    return config;
  }

  /**
   * Starts the state machine by entering either the configured initial state or the state
   * that is configured to be the current state in the state machine's context.
   */
  start(): Promise<void> {
    let initialState = this.initialState;
    if (this.context && this.context.state) {
      initialState = this.context.state;
    }
    if (initialState == undefined) {
      throw new Error('Cannot determine initial state');
    }

    const state = this.sc.get(initialState);
    if (!state) {
      throw new Error('Initial state not properly configured');
    }
    return this.notifyTransition(undefined, state.state)
      .then(() => this.enterState(state));
  }

  getCurrentState(): TState {
    if (!this.currentState) {
      return undefined;
    }
    return this.currentState.state;
  }

  getValidTriggers(): TTrigger[] {
    if (!this.currentState) {
      return [];
    } else {
      return this.currentState.getValidTriggers();
    }
  }
}