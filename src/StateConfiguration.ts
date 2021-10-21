import { StateHandler } from "./StateHandler";
import { TriggerConfiguration } from "./TriggerConfiguration";
import { StateMachine } from "./StateMachine";
import { StateMachineContext } from "./StateMachineContext";

/**
 * The configuration for a state in a state machine. This class is mainly used internally
 * to provide a fluent API when configuring the state machine, e.g. {@link #on} and {@link #handledBy}.
 */
export class StateConfiguration<TState, TTrigger, TContext extends StateMachineContext<TState>> {
  _stateMachine: StateMachine<TState, TTrigger, TContext>;
  _state: TState;
  _unguardedTriggerConfigurations: Map<TTrigger, TriggerConfiguration<TState, TTrigger, TContext>> = new Map();
  _guardedTriggerConfigurations: Map<TTrigger, TriggerConfiguration<TState, TTrigger, TContext>[]> = new Map();
  _handler?: StateHandler<TTrigger, TContext>;

  constructor(stateMachine: StateMachine<TState, TTrigger, TContext>, state: TState) {
    this._stateMachine = stateMachine;
    this._state = state;
  }

  private handleUnguarded(trigger: TTrigger): TriggerConfiguration<TState, TTrigger, TContext> {
    // An unguarded trigger cannot also be present with a guard
    if (this._guardedTriggerConfigurations.get(trigger)) {
      throw new Error(`Trigger ${trigger} on state ${this._state} is already used with a guard, cannot also be used unguarded`);
    }
    let config = this._unguardedTriggerConfigurations.get(trigger);
    if (!config) {
      config = new TriggerConfiguration(this);
      this._unguardedTriggerConfigurations.set(trigger, config);
    }
    return config;
  }

  private handleGuarded(trigger: TTrigger, guard: (context: TContext) => boolean): TriggerConfiguration<TState, TTrigger, TContext> {
    // A guarded trigger cannot also be present without a guard
    if (this._unguardedTriggerConfigurations.get(trigger)) {
      throw new Error(`Trigger ${trigger} on state ${this._state} is already used without a guard, cannot also be used guarded`);
    }

    // Get or create the list of guarded trigger configurations for this trigger
    let config = this._guardedTriggerConfigurations.get(trigger);
    if (!config) {
      config = [];
      this._guardedTriggerConfigurations.set(trigger, config);
    }
    const triggerConfiguration = new TriggerConfiguration(this, guard);
    config.push(triggerConfiguration);
    return triggerConfiguration;
  }

  isInitialState(): StateConfiguration<TState, TTrigger, TContext> {
    this._stateMachine._initialState = this._state;
    return this;
  }

  handledBy(handler: StateHandler<TTrigger, TContext>): StateConfiguration<TState, TTrigger, TContext> {
    this._handler = handler;
    return this;
  }

  on(trigger: TTrigger, guard?: (context: TContext) => boolean): TriggerConfiguration<TState, TTrigger, TContext> {
    if (!guard) {
      return this.handleUnguarded(trigger);
    } else {
      return this.handleGuarded(trigger, guard!);
    }
  }

  getValidTriggers(): TTrigger[] {
    const triggerSet = new Set<TTrigger>();
    Array.from(this._guardedTriggerConfigurations.keys()).forEach(t => triggerSet.add(t));
    Array.from(this._unguardedTriggerConfigurations.keys()).forEach(t => triggerSet.add(t));
    return Array.from(triggerSet.values());
  }
}