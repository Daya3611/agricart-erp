import { NextResponse } from 'next/server';

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'in.agricartfpc.erp.twa',
      sha256_cert_fingerprints: [
        '1B:A9:5C:FD:DE:97:B6:17:28:BC:95:A6:19:C9:0F:18:8F:BD:75:37:6F:02:5D:9C:29:27:AF:9D:35:14:8F:A0',
        'B9:58:DC:BD:5C:C3:A7:E5:54:D1:61:6A:E2:01:31:A8:D7:1F:6A:86:C2:4D:7E:77:D3:B4:5E:AC:6E:4C:19:3E'
      ],
    },
  },
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.agricarterp.app',
      sha256_cert_fingerprints: [
        '8B:C3:6C:62:6F:DC:28:A7:4A:95:E6:A6:C0:8E:17:AB:F8:84:CD:EE:CC:FD:79:45:57:4C:73:75:78:0F:D8:BF',
        'B9:58:DC:BD:5C:C3:A7:E5:54:D1:61:6A:E2:01:31:A8:D7:1F:6A:86:C2:4D:7E:77:D3:B4:5E:AC:6E:4C:19:3E,'
      ],
    },
  },
];

export async function GET() {
  return new NextResponse(JSON.stringify(assetlinks, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
