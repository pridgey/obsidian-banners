import { MarkdownRenderChild, MetadataCache, TFile, Vault } from "obsidian";
import clamp from "lodash/clamp";
import { html } from "common-tags";

import BannersPlugin, { MPPCPlus } from "./main";
import MetaManager, { BannerMetadata } from "./MetaManager";

interface XY {
  x: number;
  y: number;
}

export default class Banner extends MarkdownRenderChild {
  wrapper: HTMLElement;
  plugin: BannersPlugin;
  metadataCache: MetadataCache;
  vault: Vault;
  metaManager: MetaManager;

  ctx: MPPCPlus;
  bannerData: BannerMetadata;
  isEmbed: boolean;
  isDragging: boolean;
  prevPos: XY;

  constructor(
    plugin: BannersPlugin,
    el: HTMLDivElement,
    wrapper: HTMLElement,
    ctx: MPPCPlus,
    bannerData: BannerMetadata,
    isEmbed: boolean
  ) {
    super(el);
    this.wrapper = wrapper;
    this.plugin = plugin;
    this.metadataCache = plugin.app.metadataCache;
    this.vault = plugin.vault;
    this.metaManager = plugin.metaManager;

    this.ctx = ctx;
    this.bannerData = bannerData;
    this.isEmbed = isEmbed;
    this.isDragging = false;
    this.prevPos = null;
  }

  // Prepare and render banner
  onload() {
    const { allowMobileDrag, style, showTitle } = this.plugin.settings;
    const { containerEl: contentEl } = this.ctx;
    const {
      banner: src,
      banner_x = 0.5,
      banner_y = 0.5,
      banner_title,
    } = this.bannerData;

    this.wrapper.addClass("obsidian-banner-wrapper");
    this.containerEl.addClasses(["obsidian-banner", style]);

    const messageBox = document.createElement("div");
    messageBox.className = "banner-message";
    messageBox.innerHTML = html`
      <div class="spinner">
        <div class="bounce1"></div>
        <div class="bounce2"></div>
        <div class="bounce3"></div>
      </div>
    `;

    const img = document.createElement("img");
    img.className = "banner-image full-width";
    img.style.objectPosition = `${banner_x * 100}% ${banner_y * 100}%`;
    img.draggable = false;
    img.onload = () => {
      this.wrapper.addClass("loaded");
    };
    img.onerror = () => {
      messageBox.innerHTML = `<p>Error loading banner image! Is the <code>${this.plugin.getSettingValue(
        "frontmatterField"
      )}</code> field valid?</p>`;
      this.wrapper.addClass("error");
    };

    // Only enable banner drag adjustment in non-embed views
    if (!this.isEmbed) {
      img.onmousedown = (e) => this.handleDragStart(e);
      img.onmousemove = (e) => this.handleDragMove(e);
      contentEl.parentElement.onmouseup = () => this.handleDragEnd(img);

      if (allowMobileDrag) {
        img.ontouchstart = (e) => this.handleDragStart(e);
        img.ontouchmove = (e) => this.handleDragMove(e);
        contentEl.parentElement.ontouchend = () => this.handleDragEnd(img);
      }
    }

    img.src = this.parseSource(src);
    this.containerEl.append(messageBox, img);
    this.wrapper.prepend(this.containerEl);

    // Add Banner Title, if they want
    if (showTitle) {
      const titleEl = document.createElement("div");
      titleEl.className = "banner-title";
      titleEl.innerText = banner_title;
      console.log("Um?");
      this.containerEl.append(messageBox, titleEl);
    }
  }

  handleDragStart(e: MouseEvent | TouchEvent) {
    this.prevPos = this.getMousePos(e, this.containerEl);
    this.isDragging = true;
  }

  handleDragMove(e: MouseEvent | TouchEvent) {
    const img = e.target as HTMLImageElement;
    const wrapper = img.parentElement;

    // Only continue if dragging
    if (!this.isDragging) {
      return;
    }

    // Get delta of mouse drag
    const currentPos = this.getMousePos(e, this.containerEl);
    const delta = {
      x: ((currentPos.x - this.prevPos.x) / wrapper.clientWidth) * 100,
      y: ((currentPos.y - this.prevPos.y) / wrapper.clientHeight) * 100,
    };
    this.prevPos = currentPos;

    // Only adjust the relevant scroll axis
    const [x, y] = img.style.objectPosition
      .split(" ")
      .map((n) => parseFloat(n));

    if (
      img.naturalHeight / img.naturalWidth >=
      wrapper.clientHeight / wrapper.clientWidth
    ) {
      const newY = clamp(y - delta.y, 0, 100);
      img.style.objectPosition = `${x}% ${newY}%`;
    } else {
      const newX = clamp(x - delta.x, 0, 100);
      img.style.objectPosition = `${newX}% ${y}%`;
    }
  }

  async handleDragEnd(img: HTMLImageElement) {
    const { sourcePath } = this.ctx;

    // Only continue when finishing drag
    if (!this.isDragging) {
      return;
    }
    this.isDragging = false;

    // Update banner data
    const [x, y] = img.style.objectPosition
      .split(" ")
      .map((n) => Math.round(parseFloat(n) * 1000) / 100000);

    await this.metaManager.upsertBannerData(sourcePath, {
      banner_x: x,
      banner_y: y,
    });
  }

  // Helper to get the URL path to the image file
  parseSource(src: string): string {
    // Internal embed link format - "[[<link>]]"
    if (/^\!\[\[.+\]\]$/.test(src)) {
      const link = src.slice(3, -2);
      const file = this.metadataCache.getFirstLinkpathDest(
        link,
        this.ctx.sourcePath
      );
      return file ? this.vault.getResourcePath(file) : link;
    }

    // Absolute paths (legacy), relative paths (legacy), & URLs
    const path = src.startsWith("/") ? src.slice(1) : src;
    const file = this.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? this.vault.getResourcePath(file) : src;
  }

  // Helper to get mouse position
  getMousePos(e: MouseEvent | TouchEvent, div: HTMLElement): XY {
    const { pageX, pageY } = e instanceof MouseEvent ? e : e.targetTouches[0];
    return { x: pageX - div.offsetTop, y: pageY - div.offsetLeft };
  }
}
