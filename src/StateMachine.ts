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
  private defaultState?: StateConfiguration<TState, TTrigger, TContext>;
  private currentState?: StateConfiguration<TState, TTrigger, TContext>;
  private stateConfigurationMap: Map<TState, StateConfiguration<TState, TTrigger, TContext>> = new Map();
  private isProcessingList: boolean = false;
  private triggerList: TTrigger[] = [];
  private invalidTriggerListener?: InvalidTriggerListener<TState, TTrigger>;
  private transitionListener?: TransitionListener<TState, TTrigger>;

  protected _context: TContext;

  _initialState?: TState;

  constructor(context: TContext) {
    this._context = context;
    this.trigger = this.trigger.bind(this);
  }

  private async enterState(stateConfiguration: StateConfiguration<TState, TTrigger, TContext>, skipEntering?: boolean) {
    this.currentState = stateConfiguration;
    this._context.state = stateConfiguration._state;
    if (!stateConfiguration._handler) {
      throw new Error(`No handler for state ${stateConfiguration._state}`);
    }
    if (!skipEntering) {
      await stateConfiguration._handler.entering?.(this.trigger, this._context);
    }
  }

  private matchTrigger(stateConfiguration: StateConfiguration<TState, TTrigger, TContext> | undefined, trigger: TTrigger) {
    let triggerConfig = stateConfiguration?._unguardedTriggerConfigurations.get(trigger);
    if (!triggerConfig) {
      // OK, then let's pick the first guarded configuration whose guard evaluates to true
      const guardedTriggers = stateConfiguration?._guardedTriggerConfigurations.get(trigger) || [];
      triggerConfig = guardedTriggers.find(state => state._guard!(this._context));
    }
    return triggerConfig;
  }

  private async processTriggerList() {
    const trigger = this.triggerList.shift();
    if (!trigger || !this.currentState) {
      this.isProcessingList = false;
      return;
    }

    // Can the current state handle the trigger?
    let triggerConfig = this.matchTrigger(this.currentState, trigger);
    if (!triggerConfig) {
      // OK, can the default configuration handle the trigger?
      triggerConfig = this.matchTrigger(this.defaultState, trigger);
    }
    if (!triggerConfig) {
      if (!this.invalidTriggerListener) {
        throw new Error(`Trigger ${trigger} is not valid on state ${this.currentState._state}`);
      } else {
        // There is an invalid trigger handler, let it decide what to do
        await this.invalidTriggerListener(this.currentState._state, trigger);
      }
    } else {
      if (!triggerConfig._isIgnored) {
        if (triggerConfig._func) {
          await triggerConfig._func(this._context);
        } else {
          const exitingState = this.currentState._state;
          const enteringState = triggerConfig._targetStateConfiguration?._state;
          await this.currentState._handler?.exiting?.(this._context);
          await this.transitionListener?.(trigger, exitingState, enteringState);
          await this.enterState(triggerConfig._targetStateConfiguration!);
        }
      }
    }
    await this.processTriggerList();
  }

  /**
   * Fires a trigger on the state machine, causing it to transition to a new state.
   * @param trigger the trigger to fire
   */
  async trigger(trigger: TTrigger) {
    this.triggerList.push(trigger);
    if (this.isProcessingList) {
      return;
    }
    this.isProcessingList = true;
    await this.processTriggerList();
  }

  /**
   * Sets a listener for invalid triggers on the state machine. If no listener is set, the state
   * machine throws an error when an invalid state is encountered.
   * @param listener the listener that should be notified when an invalid trigger is fired
   */
  withInvalidTriggerListener(listener: InvalidTriggerListener<TState, TTrigger>): StateMachine<TState, TTrigger, TContext> {
    this.invalidTriggerListener = listener;
    return this;
  }

  /**
   * Sets a listener that is notified when a transition occurs in the state machine.
   * @param listener the listener that should be notified when a transition occurs
   */
  withTransitionListener(listener: TransitionListener<TState, TTrigger>): StateMachine<TState, TTrigger, TContext> {
    this.transitionListener = listener;
    return this;
  }

  /**
   * Gets or creates a state configuration and associates it with a specific state.
   */
  state(state: TState): StateConfiguration<TState, TTrigger, TContext> {
    let config = this.stateConfigurationMap.get(state);
    if (!config) {
      config = new StateConfiguration(this, state);
      this.stateConfigurationMap.set(state, config);
    }
    return config;
  }

  /**
   * Gets the default state configuration, whose triggers are applied if no trigger configuration
   * on the current state matches the trigger.
   */
  default(): StateConfiguration<TState, TTrigger, TContext> {
    if (!this.defaultState) {
      this.defaultState = new StateConfiguration(this, <any>undefined);
    }
    return this.defaultState;
  }

  /**
   * Starts the state machine by entering either the configured initial state or the state
   * that is configured to be the current state in the state machine's context.
   */
  async start() {
    let skipEntering = false;
    let initialState = this._initialState;
    if (this._context?.state) {
      // If the context indicates a current state other than the initial state, we shouldn't
      // trigger entering() because we can assume that has already been done during the previous
      // instantiation that resulted in the current state.
      skipEntering = this._context.state != this._initialState;
      initialState = this._context.state;
    }
    if (initialState == undefined) {
      throw new Error('Cannot determine initial state');
    }

    const state = this.stateConfigurationMap.get(initialState);
    if (!state) {
      throw new Error('Initial state not properly configured');
    }
    await this.enterState(state, skipEntering);
  }

  getCurrentState(): TState | undefined {
    if (!this.currentState) {
      return undefined;
    }
    return this.currentState._state;
  }

  getContext(): TContext {
    return this._context;
  }

  getValidTriggers(): TTrigger[] {
    if (!this.currentState) {
      return [];
    } else {
      return this.currentState.getValidTriggers();
    }
  }
}

export type TransitionListener<TState, TTrigger> = (trigger: TTrigger,
  exitingState: TState | undefined, enteringState: TState | undefined) => Promise<void>;

export type InvalidTriggerListener<TState, TTrigger> = (state: TState,
  trigger: TTrigger) => Promise<void>;