/* Throwaway: find the accepted request shape for 2d-vto/earring. Failed 400s are free. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { YouCamClient } from '../lib/youcam/client';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function main() {
  const c = new YouCamClient({ verbose: false });
  const clothFid = await c.uploadFile(
    readFileSync(join(FIX, 'out-cloth.jpg')),
    'image/jpeg',
    'cloth.jpg',
  );
  const earFid = await c.uploadFile(
    readFileSync(join(FIX, 'earring_c.jpg')),
    'image/jpeg',
    'ear.jpg',
  );
  console.log('uploaded. cloth fid + earring fid ready\n');

  const shapes: Array<[string, Record<string, unknown>]> = [
    ['flat ids', { src_file_id: clothFid, ref_file_ids: [earFid] }],
    ['structured name=id', { source_info: { name: clothFid }, object_infos: [{ name: earFid }] }],
    [
      'structured+param',
      { source_info: { name: clothFid }, object_infos: [{ name: earFid, parameter: {} }] },
    ],
    [
      'merged flat+structured',
      {
        src_file_id: clothFid,
        ref_file_ids: [earFid],
        source_info: { name: clothFid },
        object_infos: [{ name: earFid, parameter: { earring_need_remove_background: true } }],
      },
    ],
    [
      'flat + object_infos param',
      {
        src_file_id: clothFid,
        ref_file_ids: [earFid],
        object_infos: [{ parameter: { earring_need_remove_background: true } }],
      },
    ],
  ];

  for (const [label, body] of shapes) {
    try {
      const taskId = await c.createTask('2d-vto/earring', body);
      console.log(`✅ ACCEPTED [${label}] → task ${taskId.slice(0, 12)}…`);
      // poll to confirm it truly runs (may still error at engine stage)
      try {
        const r = await c.pollTask('2d-vto/earring', taskId);
        console.log(`   → success, keys: ${Object.keys(r).join(',')}`);
      } catch (e) {
        console.log(`   → task ran but engine said: ${String(e).slice(0, 120)}`);
      }
      console.log(
        `\n>>> WINNER: ${label}\n>>> ${JSON.stringify(body).replace(clothFid, 'CLOTH').replace(earFid, 'EARRING')}`,
      );
      return;
    } catch (e) {
      console.log(`❌ [${label}] ${String(e).slice(0, 140)}`);
    }
  }
  console.log('\nno shape accepted — inspect errors above');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
