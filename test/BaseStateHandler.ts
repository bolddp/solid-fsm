import { TestTrigger } from "./TestTrigger";
import { TestContext } from "./TestContext";
import { StateHandler } from "../src/StateHandler";

export abstract class BaseStateHandler implements StateHandler<TestTrigger, TestContext> {
  trigger: (trigger: TestTrigger) => Promise<void>;
  context: TestContext;

  protected doEntering(): Promise<void> {
    return Promise.resolve();
  }

  protected doExiting(): Promise<void> {
    return Promise.resolve();
  }

  entering(trigger: (trigger: TestTrigger) => Promise<void>, context: TestContext): Promise<void> {
    this.trigger = trigger;
    this.context = context;
    return this.doEntering();
  }

  exiting(): Promise<void> {
    return this.doExiting();
  }
}