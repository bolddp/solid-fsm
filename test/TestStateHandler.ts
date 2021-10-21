import { BaseStateHandler } from './BaseStateHandler';
import { TestTrigger } from './TestTrigger';

export class TestStateHandler extends BaseStateHandler {
  index: number;
  enterTrigger?: TestTrigger;

  constructor(index: number, enterTrigger?: TestTrigger) {
    super();
    this.index = index;
    this.enterTrigger = enterTrigger;
  }

  async doEntering(): Promise<void> {
    this.context?.logs.push(`entering ${this.index}`);
    await (this.enterTrigger ? this.trigger?.(TestTrigger.Success) : Promise.resolve());
  }

  doExiting(): Promise<void> {
    this.context?.logs.push(`exiting ${this.index}`);
    return Promise.resolve();
  }
}