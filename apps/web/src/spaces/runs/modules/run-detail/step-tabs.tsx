"use client";

import type { TaskRecord } from "@/libs/data-access/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/libs/ui/components/tabs";
import { JsonBlock } from "@/libs/ui/composites/json-block";

export function StepTabs({ record }: { readonly record: TaskRecord }) {
  const error = record.error;
  const first = error === null ? "input" : "error";

  return (
    <Tabs defaultValue={first}>
      <TabsList className="w-full">
        {error !== null && <TabsTrigger value="error">Error</TabsTrigger>}
        <TabsTrigger value="input">Input</TabsTrigger>
        <TabsTrigger value="output">Output</TabsTrigger>
      </TabsList>
      {error !== null && (
        <TabsContent value="error">
          <JsonBlock value={error} empty="No error." />
        </TabsContent>
      )}
      <TabsContent value="input">
        <JsonBlock value={record.input} empty="No input." />
      </TabsContent>
      <TabsContent value="output">
        <JsonBlock value={record.output} empty="No output: the step failed." />
      </TabsContent>
    </Tabs>
  );
}
