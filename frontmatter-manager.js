class FrontmatterManager {
  constructor(settings, app) {
    this.settings = settings;
    this.app = app;
  }

  process(file, updateFrontmatter) {
    return this.app.fileManager.processFrontMatter(file, updateFrontmatter);
  }

  ensureFrontmatter(frontmatter, timestamp) {
    if (!frontmatter.created) {
      frontmatter.created = timestamp;
    }
    if (!frontmatter.modified) {
      frontmatter.modified = timestamp;
    }
    if (this.settings.addTypeIfMissing && !frontmatter.type) {
      frontmatter.type = this.settings.typeValue;
    }
  }

  updateModified(frontmatter, timestamp) {
    frontmatter.modified = timestamp;
  }

  addTag(frontmatter, tag) {
    this.normalizeTags(frontmatter);
    if (!frontmatter.tags.includes(tag)) {
      frontmatter.tags.push(tag);
    }
  }

  ensureTagAtStart(frontmatter, tag) {
    this.normalizeTags(frontmatter);
    const existingIndex = frontmatter.tags.indexOf(tag);
    if (existingIndex > -1) {
      frontmatter.tags.splice(existingIndex, 1);
    }
    frontmatter.tags.unshift(tag);
  }

  normalizeTags(frontmatter) {
    if (!frontmatter.tags) {
      frontmatter.tags = [];
    } else if (typeof frontmatter.tags === 'string') {
      frontmatter.tags = [frontmatter.tags];
    } else if (!Array.isArray(frontmatter.tags)) {
      frontmatter.tags = [];
    }
  }
}

module.exports = FrontmatterManager;
