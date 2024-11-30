import { Constr, Data, fromHex, toHex, TxHash, UTxO } from "lucid-cardano";
import { Hydra } from ".././hydra";

import * as ed25519 from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { EmscriptenModule } from "../../types";
import { Keys } from "../../types";
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

export abstract class HydraMultiplayer {
  public key: Keys;
  hydra: Hydra;
  myIP: number = 0;
  latestUTxO: UTxO | null = null;
  packetQueue: Packet[] = [];
  module: EmscriptenModule;
  networkId: number;

  gameId?: string;

  onNewGame?: (
    gameId: string,
    players: number,
    bots: number,
    ephemeralKey: string,
  ) => void;
  onPlayerJoin?: (gameId: string, ephemeralKeys: string[]) => void;
  onTxSeen?: (txId: TxHash, tx: any) => void; // refresh timeout timers
  onPacket?: (tx: any, packet: Packet) => void;

  constructor({
    key,
    url,
    filterAddress,
    module,
    networkId = 0,
  }: {
    key: Keys;
    url: string;
    module: EmscriptenModule;
    filterAddress?: string;
    networkId?: number;
  }) {
    this.key = key;
    this.module = module;
    this.networkId = networkId;

    this.hydra = new Hydra(url, filterAddress, 100);
    this.hydra.onTxSeen = this.observeTx.bind(this);

    this.SendPacket = this.SendPacket.bind(this);
    this.setIP = this.setIP.bind(this);
  }

  public setIP(ip: number) {
    this.myIP = ip;
  }

  public async SendPacket(
    to: number,
    from: number,
    data: Uint8Array,
  ): Promise<void> {
    const ephemeralKey = this.key.publicKeyHashBytes;
    this.packetQueue.push({ to, from, ephemeralKey, data });
    await this.sendPacketQueue();
  }

  public async sendPacketQueue(): Promise<void> {
    if (this.packetQueue.length == 0 || !this.hydra.isConnected()) {
      return;
    }
    await this.selectUTxO();
    const datum = encodePackets(this.packetQueue);

    const [newUTxO, tx] = this.buildTx(datum);
    await this.hydra.submitTx(tx);
    this.latestUTxO = newUTxO;
    this.packetQueue = [];
  }

  public observeTx(txId: TxHash, tx: any): void {
    try {
      const body = tx[0];
      const outputs = body["1"];
      const output = outputs[0];
      const datumRaw: Uint8Array | undefined = output?.["2"]?.[1]?.value;
      if (!datumRaw) {
        return;
      }
      console.log("DatumRaw: ", toHex(datumRaw));
      const packets = decodePackets(datumRaw);
      if (!packets) {
        // We failed to decode packets, so this might be a new game or join game tx
        const game = decodeGame(datumRaw);
        if (this.gameId) {
          this.onPlayerJoin?.(this.gameId, game.players);
        } else {
          this.gameId = txId;
          this.onNewGame?.(
            txId,
            Number(game.playerCount),
            Number(game.botCount),
            game.players[0],
          );
        }
        return;
      }
      for (const packet of packets) {
        this.onPacket?.(tx, packet);
        if (packet.to == this.myIP) {
          const buf = this.module._malloc!(packet.data.length);
          this.module.HEAPU8!.set(packet.data, buf);
          this.module._ReceivePacket!(packet.from, buf, packet.data.length);
          this.module._free!(buf);
          this.onTxSeen?.(txId, tx);
        }
      }
    } catch (err) {
      console.warn(err);
    }
  }

  protected signData(data: string): string {
    return toHex(ed25519.sign(data, this.key.privateKeyBytes!));
  }
  public abstract selectUTxO(): Promise<void>;
  protected abstract buildTx(datum: string): [UTxO, string];
}

export interface Packet {
  to: number;
  from: number;
  ephemeralKey: Uint8Array;
  data: Uint8Array;
}

function encodePackets(packets: Packet[]): string {
  return Data.to(
    packets.map(
      ({ to, from, ephemeralKey, data }) =>
        new Constr(0, [
          BigInt(to),
          BigInt(from),
          toHex(ephemeralKey),
          toHex(data),
        ]),
    ),
  );
}

function decodePackets(raw: Uint8Array): Packet[] | undefined {
  const packets = Data.from(toHex(raw)) as Constr<Data>[];
  return packets instanceof Array
    ? packets.map((packet) => {
        const [to, from, ephemeralKey, data] = packet.fields;
        return {
          to: Number(to),
          from: Number(from),
          ephemeralKey: fromHex(ephemeralKey as string),
          data: fromHex(data as string),
        };
      })
    : undefined;
}

interface Game {
  referee_key_hash: string;
  playerCount: bigint;
  botCount: bigint;
  players: string[];
  state: "Lobby" | "Running" | "Cheated" | "Finished" | "Aborted";
  winner?: string;
  cheater?: string;
}

function decodeGame(raw: Uint8Array): Game {
  const game = Data.from(toHex(raw)) as Constr<Data>;
  const [
    referee_payment,
    playerCountRaw,
    botCountRaw,
    player_payments,
    stateTag,
    winnerRaw,
    cheaterRaw,
  ] = game.fields;
  const referee_key_hash = (referee_payment as Constr<Data>)
    .fields[0] as string;
  const playerCount = playerCountRaw as bigint;
  const botCount = botCountRaw as bigint;
  const players = (player_payments as Constr<Data>[]).map(
    (player) => player.fields[0] as string,
  );
  let state: Game["state"] = "Aborted";
  switch ((stateTag as Constr<Data>).index) {
    case 0:
      state = "Lobby";
      break;
    case 1:
      state = "Running";
      break;
    case 2:
      state = "Cheated";
      break;
    case 3:
      state = "Finished";
      break;
    default:
      state = "Aborted";
  }
  const winner = winnerRaw as Constr<Data>;
  const cheater = cheaterRaw as Constr<Data>;
  return {
    referee_key_hash: referee_key_hash,
    playerCount,
    botCount,
    players,
    state: state,
    winner: winner.index == 0 ? (winner.fields[0] as string) : undefined,
    cheater: cheater.index == 0 ? (cheater.fields[0] as string) : undefined,
  };
}
