"use client";

import { useEffect, useState } from "react";
import {
  buildEnrollment,
  createChallenge,
  createKeystore,
  enrollmentTypedData,
  formatDisclosurePublicKey,
  importRecovery,
  openCredential,
  presentCredential,
  unwrapSeed,
  verifyMerkleProof,
  type EncryptedKeystore,
  type PaybookCredentialV1,
} from "@paybook/disclosure";
import { loadJson, saveJson } from "@/lib/storage";
import { downloadJson } from "@/lib/download";
import ConnectWallet from "@/components/ConnectWallet";
import { useWallet } from "@/lib/wallet";
import { net } from "@/lib/network";

const CHAIN = process.env.NEXT_PUBLIC_CHAIN_ID ?? "SN_SEPOLIA";

export default function MePage() {
  const { account, address: connected, connected: isConnected } = useWallet();
  const [pass, setPass] = useState("");
  const [company, setCompany] = useState("");
  const [helper, setHelper] = useState(process.env.NEXT_PUBLIC_PAYBOOK_HELPER ?? "0x0");
  const [msg, setMsg] = useState("");
  const [credRaw, setCredRaw] = useState("");
  const [opened, setOpened] = useState("");
  const [merkleOk, setMerkleOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = loadJson<string>("helper", helper);
    if (h) setHelper(h);
  }, [helper]);

  function create() {
    if (pass.length < 8) {
      setMsg("Use a passphrase of at least 8 characters.");
      return;
    }
    const ks = createKeystore(pass);
    saveJson("keystore", ks.store);
    saveJson("disclosurePublicKey", ks.disclosurePublicKey);
    downloadJson("paybook-recovery.json", ks.store);
    setMsg("Keystore created. Keep the recovery file. The seed is never in a presentation.");
  }

  function recover(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const store = importRecovery(String(reader.result));
        const kp = unwrapSeed(store, pass);
        saveJson("keystore", store);
        saveJson("disclosurePublicKey", formatDisclosurePublicKey(kp));
        setMsg("Recovery file opened. Sign a new enrollment if the company does not have this key.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      }
    };
    reader.readAsText(file);
  }

  async function signEnrollment() {
    if (!account || !connected) {
      setMsg("Connect Ready first.");
      return;
    }
    const disclosurePublicKey = loadJson<string>("disclosurePublicKey", "");
    if (!disclosurePublicKey.includes(".")) {
      setMsg("Create a keystore first.");
      return;
    }
    if (!company || company === "0x0") {
      setMsg("Set the company address you are enrolling with.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        employeeAddress: connected,
        company,
        disclosurePublicKey,
        nonce: `0x${Date.now().toString(16)}`,
        expiry: Math.floor(Date.now() / 1000) + 30 * 86400,
        helper,
        chainId: CHAIN,
      };
      const td = enrollmentTypedData(body);
      const sig = await account.signMessage(td);
      const enrollment = buildEnrollment({ ...body, signature: sig });
      downloadJson("paybook-enrollment.json", enrollment);
      setMsg("Enrollment signed. Send the file to the company privately. It is never published.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function loadIssued() {
    if (!connected) {
      setMsg("Connect so we can match an issued credential to this address.");
      return;
    }
    const all = loadJson<PaybookCredentialV1[]>("issuedPayments", []);
    const mine = all.filter((c) => c.audience === "employee");
    if (mine.length === 0) {
      setMsg("No payment credentials issued in this browser.");
      return;
    }
    setCredRaw(JSON.stringify(mine[mine.length - 1], null, 2));
    setMsg("Loaded the latest payment credential issued on this machine.");
  }

  function open() {
    try {
      const store = loadJson<EncryptedKeystore | null>("keystore", null);
      const pub = loadJson<string>("disclosurePublicKey", "");
      if (!store || !pub) throw new Error("Create or recover a keystore first.");
      const kp = unwrapSeed(store, pass);
      const cred = JSON.parse(credRaw) as PaybookCredentialV1;
      const claim = openCredential(cred, kp.seed, pub);
      setOpened(JSON.stringify(claim, null, 2));
      let ok: boolean | null = null;
      if (claim.scope === "payment") {
        ok = verifyMerkleProof(claim.leafCommit, claim.merkleProof, cred.bookRoot);
      }
      setMerkleOk(ok);
      const challenge = createChallenge();
      const presentation = presentCredential({
        credential: cred,
        seed: kp.seed,
        disclosurePublicKey: pub,
        verifierChallenge: challenge,
        expiry: Math.floor(Date.now() / 1000) + 600,
      });
      saveJson("lastPresentation", { challenge, presentation, credential: cred });
      downloadJson("paybook-presentation.json", { challenge, presentation });
      setMsg(
        ok === false
          ? "Credential opened but the merkle proof failed."
          : "Credential opened. Presentation downloaded — it is not your keystore.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main>
      <h1>Employee</h1>
      <p className="lede">
        Wallet signatures authenticate. They do not wrap the key. A stolen
        presentation is not the keystore.
      </p>
      <p>
        <ConnectWallet />
      </p>

      <div className="grid">
        <div className="card">
          <label>Passphrase</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <p>
            <button type="button" onClick={create}>
              Create keystore + recovery file
            </button>
          </p>
          <label>Recover from file</label>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => e.target.files?.[0] && recover(e.target.files[0])}
          />
        </div>

        <div className="card">
          <label>Company address to enroll with</label>
          <input className="mono" value={company} onChange={(e) => setCompany(e.target.value)} />
          <label>PayrollBook helper</label>
          <input className="mono" value={helper} onChange={(e) => setHelper(e.target.value)} />
          <p>
            <button type="button" disabled={!isConnected || busy} onClick={signEnrollment}>
              Sign enrollment (SNIP-12)
            </button>
          </p>
          <p className="hint">
            Ready signs. The JSON goes to the company off-chain. Explorer never sees it.
          </p>
        </div>

        <div className="card">
          <label>Paste PaybookCredentialV1</label>
          <textarea value={credRaw} onChange={(e) => setCredRaw(e.target.value)} className="mono" />
          <p>
            <button className="ghost" type="button" onClick={loadIssued}>
              Load issued on this browser
            </button>{" "}
            <button type="button" onClick={open}>
              Open + present
            </button>
          </p>
          {merkleOk !== null && (
            <p className={merkleOk ? "ok" : "bad"}>
              {merkleOk ? "Merkle proof checks against the public book root." : "Merkle proof failed."}
            </p>
          )}
        </div>
      </div>

      {opened && <pre className="card break">{opened}</pre>}
      {msg && <p className="hint">{msg}</p>}

      <div className="card" style={{ marginTop: "1rem" }}>
        <strong>Unshield warning</strong>
        <p className="hint">
          Withdrawing a distinctive amount can link you to this pay. Prefer round
          denominations. Shielding and unshielding are public legs.{" "}
          <a href={net.faucet} target="_blank" rel="noreferrer">
            Sepolia faucet
          </a>{" "}
          if you still need test STRK.
        </p>
      </div>
    </main>
  );
}
