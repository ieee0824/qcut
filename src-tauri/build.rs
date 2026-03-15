fn main() {
  // ビルド時に git 情報を環境変数として埋め込む
  // GIT_DESCRIBE: タグがあれば "v0.3.0" や "v0.3.0-3-gabcdef1"、なければ短縮ハッシュ
  let git_describe = std::process::Command::new("git")
    .args(["describe", "--tags", "--always", "--dirty"])
    .output()
    .ok()
    .and_then(|o| {
      if o.status.success() {
        String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
      } else {
        None
      }
    })
    .unwrap_or_else(|| "unknown".to_string());

  println!("cargo:rustc-env=GIT_DESCRIBE={}", git_describe);
  println!("cargo:rerun-if-changed=../.git/HEAD");
  println!("cargo:rerun-if-changed=../.git/refs/");

  tauri_build::build()
}
