#!/usr/bin/env bash
set -euo pipefail

stage_path=${1:?usage: stage-pages.sh STAGE_PATH}
git diff --quiet --
git diff --cached --quiet --

mkdir -p "$stage_path"
count=0
while IFS= read -r path || [[ -n "$path" ]]; do
  [[ -n "$path" ]] || { echo 'Empty Pages allowlist path' >&2; exit 1; }
  [[ "$path" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo 'Unsafe Pages allowlist path' >&2; exit 1; }
  case "$path" in
    /*|*\\*|*//*|.|./*|*/.|..|../*|*/..|*/../*) echo 'Unsafe Pages allowlist path' >&2; exit 1 ;;
  esac
  entry=$(git ls-tree HEAD -- "$path")
  [[ -n "$entry" ]] || { echo "Missing committed Pages path: $path" >&2; exit 1; }
  metadata=${entry%%$'\t'*}
  listed_path=${entry#*$'\t'}
  read -r mode type object_id <<< "$metadata"
  [[ "$listed_path" == "$path" && "$type" == blob && ( "$mode" == 100644 || "$mode" == 100755 ) ]] || { echo "Unsafe committed Pages entry: $path" >&2; exit 1; }
  mkdir -p "$stage_path/$(dirname "$path")"
  git cat-file blob "$object_id" > "$stage_path/$path"
  count=$((count + 1))
done < <(git show HEAD:deploy/pages-allowlist.txt)

[[ "$count" -gt 0 ]]
[[ "$(find "$stage_path" -type f | wc -l)" -eq "$count" ]]
