// Seed candidates: real, publicly known Agent-ID free-mint contracts on BSC.
// These addresses were published by the projects themselves; the sentinel
// re-verifies every one of them LIVE on every run — nothing here is trusted
// on reputation alone. Add new candidates by appending an entry.
export const CANDIDATES = [
  {
    address: "0x08e3e40829718913fb627c818cb334b1e3d5b699",
    name: "Rulz Share",
    note: "RSHARE free mint (1/wallet), Agent ID gated",
  },
  {
    address: "0xfcadfb7cc85b6ea540d64e4f4b9f162e630f55c0",
    name: "Agent Mint Pass",
    note: "AMT mint pass, +5,000 AMT per mint",
  },
  {
    address: "0x5b49b06a2e25fce0bca865be70f3c62b6319367a",
    name: "MOSSMINDS",
    note: "MOSS free-mint candidate",
  },
  {
    address: "0xc22d29A0411B2B76D723E5f9fDEb5B7cc509AF48",
    name: "RONAGENT",
    note: "RONAG free-mint candidate",
  },
  {
    address: "0x156482ad3f0eebd8e3f70d494ebd1da3f738f5ba",
    name: "ONLYAI",
    note: "OCRY free-mint candidate",
  },
];

// A clearly synthetic probe address — used ONLY for read-only eth_call probes
// (balanceOf / hasClaimed / free-lane static calls). Never a real wallet,
// never used to sign or send anything.
export const PROBE_WALLET = "0x1111111111111111111111111111111111111111";
