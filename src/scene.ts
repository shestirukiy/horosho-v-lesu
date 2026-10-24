import { Application, Assets, Container, Sprite, Text, TextStyle, Graphics } from 'pixi.js';

export class SimsScene {
  app: Application;
  container: Container;
  avatarContainer: Container;
  artemSprite!: Sprite;
  irinaSprite!: Sprite;
  bubbleContainer: Container;
  bubbleSprite!: Sprite;
  bubbleText!: Text;
  glowGraphics!: Graphics;
  heartParticles: Sprite[] = [];

  currentPartner: 'Артем' | 'Ирина' = 'Ирина';
  private targetScale = 1;
  private time = 0;

  constructor() {
    this.app = new Application();
    this.container = new Container();
    this.avatarContainer = new Container();
    this.bubbleContainer = new Container();
  }

  async init(canvas: HTMLCanvasElement) {
    const parent = canvas.parentElement!;
    await this.app.init({
      canvas,
      width: parent.clientWidth || 400,
      height: parent.clientHeight || 750,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    this.app.stage.addChild(this.container);

    // Mood Glow behind avatar
    this.glowGraphics = new Graphics();
    this.container.addChild(this.glowGraphics);

    // Avatar Layer
    this.container.addChild(this.avatarContainer);

    // Load Textures
    const [artemTex, irinaTex, bubbleTex, heartTex] = await Promise.all([
      Assets.load('/artem_avatar.png'),
      Assets.load('/irina_avatar.png'),
      Assets.load('/Bubble.png'),
      Assets.load('/Heart.png'),
    ]);

    // Artem Sprite
    this.artemSprite = new Sprite(artemTex);
    this.artemSprite.anchor.set(0.5, 0.5);
    this.artemSprite.visible = false;
    this.avatarContainer.addChild(this.artemSprite);

    // Irina Sprite
    this.irinaSprite = new Sprite(irinaTex);
    this.irinaSprite.anchor.set(0.5, 0.5);
    this.irinaSprite.visible = true;
    this.avatarContainer.addChild(this.irinaSprite);

    // Thought Bubble Container
    this.bubbleContainer.visible = true;
    this.container.addChild(this.bubbleContainer);

    this.bubbleSprite = new Sprite(bubbleTex);
    this.bubbleSprite.anchor.set(0.5, 0.5);
    this.bubbleSprite.width = 180;
    this.bubbleSprite.height = 110;
    this.bubbleContainer.addChild(this.bubbleSprite);

    const style = new TextStyle({
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      fontWeight: '600',
      fill: '#1a2a21',
      wordWrap: true,
      wordWrapWidth: 150,
      align: 'center',
    });
    this.bubbleText = new Text({ text: 'Хорошо в Лесу', style });
    this.bubbleText.anchor.set(0.5, 0.5);
    this.bubbleContainer.addChild(this.bubbleText);

    // Ambient floating hearts
    for (let i = 0; i < 4; i++) {
      const heart = new Sprite(heartTex);
      heart.anchor.set(0.5, 0.5);
      heart.scale.set(0.15 + Math.random() * 0.1);
      heart.alpha = 0.2 + Math.random() * 0.3;
      heart.x = (Math.random() - 0.5) * 260;
      heart.y = (Math.random() - 0.5) * 300;
      this.heartParticles.push(heart);
      this.container.addChild(heart);
    }

    // Resize handling
    this.layout();
    window.addEventListener('resize', () => this.layout());

    // Ticker Loop (Gentle Sims Breathing and Bobbing)
    this.app.ticker.add((ticker) => {
      this.time += ticker.deltaTime * 0.03;

      // Subtle avatar breathing
      const breath = Math.sin(this.time) * 0.015;
      this.avatarContainer.scale.set(this.targetScale * (1 + breath), this.targetScale * (1 - breath * 0.5));

      // Gentle floating thought bubble
      this.bubbleContainer.y = this.avatarContainer.y - (380 * this.targetScale) + Math.sin(this.time * 1.5) * 6;

      // Ambient hearts drifting
      for (let i = 0; i < this.heartParticles.length; i++) {
        const h = this.heartParticles[i];
        h.y -= ticker.deltaTime * 0.4;
        h.x += Math.sin(this.time + i) * 0.3;
        if (h.y < -300) {
          h.y = 200;
          h.x = (Math.random() - 0.5) * 240;
        }
      }
    });
  }

  setPartner(partner: 'Артем' | 'Ирина') {
    this.currentPartner = partner;
    if (partner === 'Артем') {
      this.artemSprite.visible = true;
      this.irinaSprite.visible = false;
    } else {
      this.artemSprite.visible = false;
      this.irinaSprite.visible = true;
    }
  }

  setMoodColor(colorName: string) {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    let hex = 0xf1c40f; // Yellow default
    const c = (colorName || '').toLowerCase();
    if (c.includes('green') || c.includes('зел')) hex = 0x2ecc71;
    else if (c.includes('red') || c.includes('крас')) hex = 0xe74c3c;
    else if (c.includes('blue') || c.includes('син')) hex = 0x3498db;
    else if (c.includes('pink') || c.includes('розов')) hex = 0xff7675;

    this.glowGraphics.clear();
    // Ambient back aura
    this.glowGraphics.circle(w / 2, h * 0.45, 180);
    this.glowGraphics.fill({ color: hex, alpha: 0.12 });

    this.glowGraphics.circle(w / 2, h * 0.45, 120);
    this.glowGraphics.fill({ color: hex, alpha: 0.18 });
  }

  setThought(thought: string) {
    const trimmed = (thought || '').trim();
    if (trimmed.length > 0) {
      this.bubbleContainer.visible = true;
      this.bubbleText.text = trimmed.length > 50 ? trimmed.slice(0, 47) + '...' : trimmed;
    } else {
      this.bubbleContainer.visible = false;
    }
  }

  layout() {
    const parent = this.app.canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth || 400;
    const h = parent.clientHeight || 750;

    this.app.renderer.resize(w, h);

    // Position avatar in upper center
    this.avatarContainer.x = w / 2;
    this.avatarContainer.y = h * 0.44;

    // Scale avatar to fit nicely inside upper half of screen
    const targetHeight = h * 0.52;
    this.targetScale = targetHeight / 1536;
    this.avatarContainer.scale.set(this.targetScale);

    // Bubble position
    this.bubbleContainer.x = w / 2 + 30;
    this.bubbleContainer.y = this.avatarContainer.y - (380 * this.targetScale);

    this.setMoodColor('Yellow');
  }
}
