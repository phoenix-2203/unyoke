/**
 * Tiny protobuf encoders for the grant payloads Unyoke's demo and tests create
 * (the SDK registry does not include these inner types). Only what is needed:
 * strings and nested messages, each under 128 bytes.
 */
const enc = new TextEncoder();

function lenField(field: number, bytes: Uint8Array): Uint8Array {
  if (bytes.length > 127) throw new Error("payload too long for the mini encoder");
  return Uint8Array.from([(field << 3) | 2, bytes.length, ...bytes]);
}

const coin = (denom: string, amount: string) =>
  Uint8Array.from([...lenField(1, enc.encode(denom)), ...lenField(2, enc.encode(amount))]);

/** cosmos.authz.v1beta1.GenericAuthorization { msg } */
export function genericAuthorization(msgTypeUrl: string): { typeUrl: string; value: Uint8Array } {
  return { typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization", value: lenField(1, enc.encode(msgTypeUrl)) };
}

/** cosmos.bank.v1beta1.SendAuthorization { spend_limit: [Coin] } */
export function sendAuthorization(denom: string, amount: string): { typeUrl: string; value: Uint8Array } {
  return { typeUrl: "/cosmos.bank.v1beta1.SendAuthorization", value: lenField(1, coin(denom, amount)) };
}

/** cosmos.feegrant.v1beta1.BasicAllowance { spend_limit: [Coin] } (no limit when amount is omitted) */
export function basicAllowance(denom?: string, amount?: string): { typeUrl: string; value: Uint8Array } {
  const value = denom && amount ? lenField(1, coin(denom, amount)) : new Uint8Array();
  return { typeUrl: "/cosmos.feegrant.v1beta1.BasicAllowance", value };
}
