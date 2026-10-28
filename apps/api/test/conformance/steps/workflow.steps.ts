import { Given } from 'quickpickle';

Given('a workflow with definition:', (world, definition: string) => {
  world.data.definition = definition;
});

Given('given the workflow input is:', (world, input: string) => {
  world.data.input = input;
});
