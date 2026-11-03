import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/data-access/types';
import { graphOf, type Graph } from './graph';
import {
  type Box,
  type Direction,
  type Placement,
  placementOf,
  type Point,
} from './layout';

const elk = new ELK();

const pipeline: JsonObject = {
  document: {
    dsl: '1.0.3',
    namespace: 'sales',
    name: 'lead-pipeline',
    version: '1.0.0',
  },
  do: [
    { fetchLead: { set: { email: '${ .email }', score: '${ .score }' } } },
    {
      route: {
        switch: [
          { hot: { when: '${ .score > 50 }', then: 'enrich' } },
          { cold: { then: 'archive' } },
        ],
      },
    },
    {
      enrich: {
        try: [
          {
            callCrm: {
              call: 'http',
              with: { method: 'get', endpoint: 'https://crm.example.com' },
            },
          },
          { merge: { set: { merged: true } } },
        ],
        catch: { as: 'error', do: [{ useCache: { set: { cached: true } } }] },
      },
    },
    {
      eachTouch: {
        for: { each: 'touch', in: '${ [1, 2, 3] }' },
        do: [{ pauseBetween: { wait: { seconds: 1 } } }],
      },
    },
    {
      notifyAll: {
        fork: {
          branches: [
            { email: { set: { email: true } } },
            { slack: { set: { slack: true } } },
          ],
        },
      },
    },
    { archive: { set: { archived: true }, then: 'end' } },
  ],
};

async function placed(
  document: JsonObject,
  direction: Direction,
  editable = false,
): Promise<{ graph: Graph; placement: Placement }> {
  const graph = graphOf(document, { editable, collapsed: new Set() });
  const placement = await placementOf(graph, direction, editable, elk);
  return { graph, placement };
}

// Positions on the canvas: ELK gives a node's relative to its group.
function absolute(graph: Graph, placement: Placement): Map<string, Box> {
  const boxes = new Map<string, Box>();

  for (const node of graph.nodes) {
    const own = placement.nodes.get(node.id);

    if (own === undefined) continue;

    const parent = node.parentId === null ? null : boxes.get(node.parentId);
    boxes.set(node.id, {
      x: own.x + (parent?.x ?? 0),
      y: own.y + (parent?.y ?? 0),
      width: own.width,
      height: own.height,
    });
  }

  return boxes;
}

// Whether a horizontal or vertical segment passes through the inside of a box.
function crosses(from: Point, to: Point, box: Box): boolean {
  const inset = 2;
  const left = box.x + inset;
  const right = box.x + box.width - inset;
  const top = box.y + inset;
  const bottom = box.y + box.height - inset;
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  return maxX > left && minX < right && maxY > top && minY < bottom;
}

describe('the canvas laid out by ELK', () => {
  it('keeps_the_documents_order_from_top_to_bottom', async () => {
    const { graph, placement } = await placed(pipeline, 'down');
    const boxes = absolute(graph, placement);
    const order = [
      'start',
      '/do/0/fetchLead',
      '/do/1/route',
      '/do/2/enrich',
      '/do/3/eachTouch',
      '/do/4/notifyAll',
      '/do/5/archive',
      'end',
    ];
    const tops = order.map((id) => boxes.get(id)?.y ?? Number.NaN);

    expect(tops).toEqual(tops.slice().sort((a, b) => a - b));
  });

  it.each<Direction>(['down', 'right'])(
    'draws_no_connection_through_a_step_and_no_two_steps_over_each_other_%s',
    async (direction) => {
      const { graph, placement } = await placed(pipeline, direction, true);
      const boxes = absolute(graph, placement);
      const leaves = graph.nodes.filter(
        (node) =>
          (node.kind !== 'group' && node.kind !== 'handler') || node.collapsed,
      );
      const throughSteps: string[] = [];
      const overlaps: string[] = [];

      for (const edge of graph.edges) {
        const points = placement.edges.get(edge.id)?.points ?? [];

        for (let at = 1; at < points.length; at += 1) {
          const from = points[at - 1];
          const to = points[at];

          if (from === undefined || to === undefined) continue;

          for (const leaf of leaves) {
            if (leaf.id === edge.source || leaf.id === edge.target) continue;

            const box = boxes.get(leaf.id);

            if (box !== undefined && crosses(from, to, box))
              throughSteps.push(`${edge.id} through ${leaf.id}`);
          }
        }
      }

      leaves.forEach((one, index) => {
        for (const other of leaves.slice(index + 1)) {
          const a = boxes.get(one.id);
          const b = boxes.get(other.id);

          if (a === undefined || b === undefined) continue;

          const apart =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y;

          if (!apart) overlaps.push(`${one.id} over ${other.id}`);
        }
      });

      expect(throughSteps).toEqual([]);
      expect(overlaps).toEqual([]);
    },
  );

  it('places_every_edge_and_its_labels_and_add_buttons', async () => {
    const { graph, placement } = await placed(pipeline, 'down', true);
    const missing = graph.edges.filter(
      (edge) => (placement.edges.get(edge.id)?.points.length ?? 0) < 2,
    );
    const hot = graph.edges.find((edge) => edge.label === 'hot');
    const labels =
      hot === undefined ? [] : (placement.edges.get(hot.id)?.labels ?? []);
    const onward = graph.edges.find((edge) => edge.insertAt !== null);
    const add =
      onward === undefined
        ? []
        : (placement.edges.get(onward.id)?.labels ?? []);

    expect(missing.map((edge) => edge.id)).toEqual([]);
    expect(labels.map((label) => label.role)).toEqual(['label']);
    expect(add.map((label) => label.role)).toContain('add');
  });

  it('sends_the_cases_of_a_choice_from_left_to_right_in_their_order', async () => {
    const { placement } = await placed(pipeline, 'down');
    const ports = placement.nodes.get('/do/1/route')?.ports ?? {};

    expect(ports['case-0']?.x).toBeLessThan(ports['case-1']?.x ?? 0);
  });
});
