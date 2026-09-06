import { assertEquals } from "@std/assert";
import {
  artifactFileName,
  checksumFileName,
  DENO_COMPILE_TARGETS,
  installScriptFileName,
  linuxTargetFromUnameArch,
  releaseTagCandidates,
  targetFromRunner,
} from "./distribution.ts";

Deno.test("cli.distribution target matrix and artifact naming", async (t) => {
  await t.step("publishes exactly the six Deno compile targets", () => {
    assertEquals([...DENO_COMPILE_TARGETS], [
      "x86_64-unknown-linux-gnu",
      "aarch64-unknown-linux-gnu",
      "x86_64-pc-windows-msvc",
      "aarch64-pc-windows-msvc",
      "x86_64-apple-darwin",
      "aarch64-apple-darwin",
    ]);
  });

  await t.step("names Linux/macOS artifacts without .exe", () => {
    assertEquals(
      artifactFileName("1.2.3", "x86_64-unknown-linux-gnu"),
      "uffda-1.2.3-x86_64-unknown-linux-gnu",
    );
    assertEquals(
      artifactFileName("1.2.3", "aarch64-apple-darwin"),
      "uffda-1.2.3-aarch64-apple-darwin",
    );
  });

  await t.step("names Windows artifacts with .exe", () => {
    assertEquals(
      artifactFileName("1.2.3", "x86_64-pc-windows-msvc"),
      "uffda-1.2.3-x86_64-pc-windows-msvc.exe",
    );
  });

  await t.step("uses stable checksum and install script asset names", () => {
    assertEquals(checksumFileName(), "SHA256SUMS");
    assertEquals(installScriptFileName(), "install.sh");
  });

  await t.step("maps GitHub runner OS/arch pairs to targets", () => {
    assertEquals(targetFromRunner("Linux", "X64"), "x86_64-unknown-linux-gnu");
    assertEquals(
      targetFromRunner("Linux", "ARM64"),
      "aarch64-unknown-linux-gnu",
    );
    assertEquals(
      targetFromRunner("Windows", "X64"),
      "x86_64-pc-windows-msvc",
    );
    assertEquals(
      targetFromRunner("macOS", "ARM64"),
      "aarch64-apple-darwin",
    );
    assertEquals(targetFromRunner("FreeBSD", "X64"), undefined);
  });

  await t.step("maps Linux uname -m values for the install script", () => {
    assertEquals(
      linuxTargetFromUnameArch("x86_64"),
      "x86_64-unknown-linux-gnu",
    );
    assertEquals(
      linuxTargetFromUnameArch("aarch64"),
      "aarch64-unknown-linux-gnu",
    );
    assertEquals(linuxTargetFromUnameArch("i686"), undefined);
  });

  await t.step(
    "resolves bare SemVer release tags before v-prefixed ones",
    () => {
      assertEquals(releaseTagCandidates("latest"), ["latest"]);
      assertEquals(releaseTagCandidates("0.1.2"), ["0.1.2", "v0.1.2"]);
      assertEquals(releaseTagCandidates("v0.1.2"), ["0.1.2", "v0.1.2"]);
    },
  );
});
