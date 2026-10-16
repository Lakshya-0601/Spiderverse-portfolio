// Background song, streamed through YouTube's official embedded player.
// The song is never hosted here: the official video plays from YouTube under
// their licence. YouTube's rules require the player to stay visible (≥200×200)
// while it plays, so it lives in a small "Now playing" card; when sound is off
// the song pauses and the card slides away.

export const SONG = {
  id: 'ApXoWvfEYVU', // official video, PostMaloneVEVO (embedding allowed)
  title: 'Sunflower',
  artist: 'Post Malone, Swae Lee',
};

export class Music {
  constructor(card) {
    this.card = card; // the .now-playing element
    this.mount = card.querySelector('.now-playing__player');
    this.player = null;
    this.ready = false;
    this.failed = false;
    this.wantPlay = false;
    this.volume = 50; // 0..100 (YouTube scale)
    this.duck = 1; // temporary dip, e.g. while diving through the portal
    this.collapsed = false;
    this.onState = null; // ('playing' | 'paused' | 'error') => void
  }

  // Load YouTube's player API only when the song is first needed.
  _load() {
    if (this._loading) return this._loading;
    this._loading = new Promise((resolve, reject) => {
      if (window.YT?.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => reject(new Error('YouTube API blocked'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('YouTube API timeout')), 15000);
    }).then(
      () =>
        new Promise((resolve) => {
          this.player = new window.YT.Player(this.mount, {
            videoId: SONG.id,
            host: 'https://www.youtube-nocookie.com', // privacy-enhanced mode
            width: '100%',
            height: '100%',
            playerVars: { autoplay: 0, controls: 1, loop: 1, playlist: SONG.id, playsinline: 1, rel: 0, modestbranding: 1, fs: 0 },
            events: {
              onReady: () => {
                this.ready = true;
                this._applyVolume();
                if (this.wantPlay) this.player.playVideo();
                resolve();
              },
              onStateChange: (e) => {
                if (e.data === 1) this.onState?.('playing');
                else if (e.data === 2) this.onState?.('paused');
              },
              onError: () => this._fail(),
            },
          });
        })
    );
    this._loading.catch(() => this._fail());
    return this._loading;
  }

  _fail() {
    this.failed = true;
    this.card.classList.remove('show');
    this.onState?.('error');
  }

  // Sound on → the card appears (and plays, unless the visitor collapsed it).
  show() {
    if (this.failed) return;
    this.card.classList.add('show');
    if (!this.collapsed) this._play();
  }

  // Sound off → song paused, card hidden.
  hide() {
    this.card.classList.remove('show');
    this._pause();
  }

  // Collapsing the card pauses the song (a playing player must stay visible).
  collapse() {
    this.collapsed = true;
    this.card.classList.add('collapsed');
    this._pause();
    this.onState?.('paused');
  }

  expand() {
    this.collapsed = false;
    this.card.classList.remove('collapsed');
    this._play();
    this.onState?.('playing');
  }

  get active() {
    return !this.failed && !this.collapsed;
  }

  _play() {
    this.wantPlay = true;
    this._load().then(() => this.player.playVideo(), () => {});
  }

  _pause() {
    this.wantPlay = false;
    if (this.ready) this.player.pauseVideo();
  }

  setVolume(v) {
    this.volume = Math.round(v);
    this._applyVolume();
  }

  setDuck(k) {
    if (Math.abs(k - this.duck) < 0.03) return;
    this.duck = k;
    this._applyVolume();
  }

  _applyVolume() {
    if (!this.ready) return;
    const v = Math.round(this.volume * this.duck);
    this.player.setVolume(v);
    if (v === 0) this.player.mute();
    else this.player.unMute();
  }
}
