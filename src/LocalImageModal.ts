import { html } from 'common-tags';
import { FuzzyMatch, FuzzySuggestModal, MetadataCache, TFile, Vault } from 'obsidian';

import BannersPlugin from './main';
import MetaManager from './MetaManager';

const IMAGE_FORMATS = ['apng', 'avif', 'gif', 'jpg', 'jpeg', 'jpe', 'jif', 'jfif', 'png', 'webp'];

export default class LocalImageModal extends FuzzySuggestModal<TFile> {
  plugin: BannersPlugin;
  vault: Vault;
  metadataCache: MetadataCache;
  metaManager: MetaManager;
  targetFile: TFile;

  constructor(plugin: BannersPlugin, file: TFile) {
    super(plugin.app);
    this.plugin = plugin;
    this.vault = plugin.app.vault;
    this.metadataCache = plugin.app.metadataCache;
    this.metaManager = plugin.metaManager;

    this.containerEl.addClass('banner-local-image-modal');
    this.targetFile = file;
    this.limit = this.plugin.getSettingValue('localSuggestionsLimit');
    this.setPlaceholder('Pick an image to use as a banner');
  }

  getItems(): TFile[] {
    const folder = this.plugin.getSettingValue('bannersFolder');
    return this.vault.getFiles().filter(f => (
      IMAGE_FORMATS.includes(f.extension) &&
      (!folder || f.parent.path.contains(folder))
    ));
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  renderSuggestion(match: FuzzyMatch<TFile>, el: HTMLElement) {
    super.renderSuggestion(match, el);

    const { showPreviewInLocalModal } = this.plugin.settings;
    if (showPreviewInLocalModal) {
      const content = el.innerHTML;
      el.addClass('banner-suggestion-item');
      el.innerHTML = html`
        <p class="suggestion-text">${content}</p>
        <div class="suggestion-image-wrapper">
          <img src="${this.vault.getResourcePath(match.item)}" />
        </div>
      `;
    }
  }

  async onChooseItem(image: TFile) {
    const link = this.metadataCache.fileToLinktext(image, this.targetFile.path);
    await this.metaManager.upsertBannerData(this.targetFile, { banner: `"![[${link}]]"` });
  }
}
