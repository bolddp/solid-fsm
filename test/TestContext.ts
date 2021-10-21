import { TestState } from "./TestState";
import { StateMachineContext } from "../src/StateMachineContext";

export class TestContext implements StateMachineContext<TestState> {
  state?: TestState;
  logs: string[] = [];
  guard: boolean = false;
}