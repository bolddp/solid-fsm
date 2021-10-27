import { TestTrigger } from "./TestTrigger";
import { TestContext } from "./TestContext";
import { StateHandler } from "../src/StateHandler";

export class TestStateHandler implements StateHandler<TestTrigger, TestContext> {
  index: number;
  enterTrigger?: TestTrigger;

  constructor(index: number, enterTrigger?: TestTrigger) {
    this.index = index;
    this.enterTrigger = enterTrigger;
  }

  async entering(trigger: (trigger: TestTrigger) => Promise<void>, context: TestContext) {
    context.logs.push(`entering ${this.index}`);
    await (this.enterTrigger ? trigger(TestTrigger.Success) : Promise.resolve());
  }

  async exiting(context: TestContext) {
    context.logs.push(`exiting ${this.index}`);
  }
}