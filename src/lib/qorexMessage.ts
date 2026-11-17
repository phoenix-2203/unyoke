/**
 * QoreX `signAndBroadcast` takes each message as a type URL plus protobuf
 * bytes. This turns the `{ typeUrl, value }` objects the QoreChain SDK builds
 * into that shape, using the SDK's own type registry (QoreChain + Cosmos types).
 */
import { qorechainRegistry } from "@qorechain/sdk";

export interface EncodeObjectLike {
  typeUrl: string;
  value: unknown;
}

export interface QorexMessage {
  typeUrl: string;
  value: Uint8Array;
}

let registry: ReturnType<typeof qorechainRegistry> | undefined;

export function toQorexMessage(msg: EncodeObjectLike): QorexMessage {
  registry ??= qorechainRegistry();
  if (!registry.lookupType(msg.typeUrl)) {
    throw new Error(`No protobuf type known for ${msg.typeUrl}`);
  }
  return { typeUrl: msg.typeUrl, value: registry.encode(msg as { typeUrl: string; value: object }) };
}
