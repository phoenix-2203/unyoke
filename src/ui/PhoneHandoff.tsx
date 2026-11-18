/**
 * Revoking needs the QoreX mobile app (it opens a post-quantum window for each
 * EVM transaction). On desktop, show a QR code that opens this same scan on the
 * phone; in a phone's ordinary browser, help move the link into QoreX.
 */
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { isQorexMobile } from "./qorexEnv";

const isPhone = () => typeof navigator !== "undefined" && /Mobile|iPhone|iPad|Android/i.test(navigator.userAgent);

export function scanLink(address: string): string {
  return `${window.location.origin}/app?address=${encodeURIComponent(address)}`;
}

/**
 * QoreX's universal link: opens a page straight in the QoreX app's browser
 * (and offers the app if it isn't installed). The same link the Build Before
 * Q-Day site uses for voting from a phone.
 */
export function qorexBrowseLink(url: string): string {
  return `https://link.qore.network/browse?url=${encodeURIComponent(url)}`;
}

export function PhoneHandoff({ address }: { address: string }) {
  const link = scanLink(address);
  const open = qorexBrowseLink(link);
  const [svg, setSvg] = useState<string>();
  const [copied, setCopied] = useState(false);
  const phone = isPhone();

  useEffect(() => {
    if (phone) return;
    QRCode.toString(open, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0c0e", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(undefined));
  }, [open, phone]);

  if (isQorexMobile()) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is shown below to copy by hand */
    }
  }

  if (phone) {
    return (
      <div className="handoff">
        <div className="handoff-text">
          <span className="kicker mono">revoke from QoreX</span>
          <h3>Open this scan in the QoreX app</h3>
          <p className="muted">
            QoreX signs revokes with your post-quantum key and opens a one-transaction window for each token. If the button doesn't
            switch to QoreX, copy the link and paste it into QoreX's browser.
          </p>
          <div className="handoff-actions">
            <a className="button" href={open}>
              Open in QoreX
            </a>
            <button type="button" className="ghost" onClick={copy}>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="handoff">
      {svg ? (
        <div className="handoff-qr" role="img" aria-label="QR code for this scan" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="handoff-qr" />
      )}
      <div className="handoff-text">
        <span className="kicker mono">continue on your phone</span>
        <h3>Revoke from the QoreX app</h3>
        <p className="muted">
          QoreChain only accepts EVM transactions inside a post-quantum window, and only QoreX mobile opens one for you. Desktop
          wallets can scan but not revoke.
        </p>
        <ol>
          <li>Scan the code with your phone's camera.</li>
          <li>It opens this same scan in the QoreX app, ready to revoke.</li>
          <li>Opened in your phone's browser instead? Tap <b>Copy link</b> there and paste it into QoreX's browser.</li>
        </ol>
        <button type="button" className="ghost" onClick={copy}>
          {copied ? "Copied ✓" : "Copy link instead"}
        </button>
      </div>
    </div>
  );
}
