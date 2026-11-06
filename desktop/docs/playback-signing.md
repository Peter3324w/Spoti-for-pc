# Windows embedded playback signing

## Confirmed failure, November 6, 2026

A signed-in Windows test selected the first Liked Songs track. Spotify's audio
licence endpoint returned repeated HTTP 500 responses. The media clock advanced
less than a second, several tracks were skipped, and the page eventually played an
advert at the near-silent volume set by the inherited Myspoti ad handler. The music
volume was otherwise 1.0, the page was the active Connect device, and media keys
were present. The availability of Widevine itself did not establish usable licences.

The official local signature verifier reports:

```
ValidityError: Certificate is valid for development only
```

Castlabs documents this exact Spotify symptom and its resolution through EVS:
https://github.com/castlabs/electron-releases/issues/193

## Required external step

The unmodified Windows Castlabs runtime needs a streaming VMP signature from EVS,
including when used for local development. This is not an application production
build or installer. The service is free and requires an email-verified account.
Do not create an account for Peter or choose account details without his approval.
He should enter passwords and email verification codes locally, not in chat.

Official instructions:
- https://github.com/castlabs/electron-releases/wiki/EVS
- https://github.com/castlabs/electron-releases/wiki/FAQ#how-can-i-vmp-sign-my-application-during-development

With the official `castlabs-evs` Python client installed:

```
python -m castlabs_evs.vmp --no-ask verify-pkg /path/to/extracted/windows/runtime
python -m castlabs_evs.account signup
python -m castlabs_evs.vmp sign-pkg /path/to/extracted/windows/runtime
python -m castlabs_evs.vmp --no-ask verify-pkg /path/to/extracted/windows/runtime
```

For an existing account, use `python -m castlabs_evs.account reauth` instead of
signup. The default signature kind is streaming; do not request persistent signing.
Preserve the original archive. Stop the owned development app before signing its
runtime, then restart and verify an actual selected song, pause/resume and track
switching. Repeat signing when the runtime changes. Account tokens stay outside the
repository in the official client's user configuration.

## App behavior until resolved

A failed audio-licence response disposes the playback view and JVM, retains a clear
setup error, and rejects further play/skip requests until an explicit reconnect.
This prevents both Spotify autoplay and Kotlin recovery from continuing a silent
skip loop. It does not fix licence acceptance or establish successful audio.
Login stays hidden after first authentication; a transient status refresh cannot
flash the Spotify page back over the app. Browser navigations are hidden until
loaded so their blank page is not shown over the local interface.
