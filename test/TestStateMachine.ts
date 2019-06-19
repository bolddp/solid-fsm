import { StateMachine } from "./../src/StateMachine";
import { TestState } from "./TestState";
import { TestTrigger } from "./TestTrigger";
import { TestContext } from "./TestContext";

export class TestStateMachine extends StateMachine<TestState, TestTrigger, TestContext> {
  constructor(config: (sm: TestStateMachine) => void, context?: TestContext) {
    super(context || new TestContext());
    config(this);
  }
}
