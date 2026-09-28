import { NextRequest } from "next/server";
import { POST as verifyQrHandler } from "../verify-qr/route";

export async function POST(req: NextRequest) {
  return verifyQrHandler(req);
}
