(function(previewer) {
  class ContextMenu {
    constructor(selector, menuItems) {
      const menus = document.createElement("ul");
      menus.classList.add("context-menu-list");
      menus.style.width = "210px";
      menus.style.display = "none";
      menus.style.zIndex = "1";
      this.menus = menus;
      this.selector = selector ? selector : document;
      this.markdown_types = {};
      this.initMenuItem(menuItems);
      document.body.appendChild(this.menus);
      this.initWindowEvents();
    }

    initWindowEvents() {
      const that = this;
      this.selector.addEventListener("contextmenu", event => {
        event.preventDefault();
        that.show(event.clientX, event.clientY);
      });
      document.addEventListener("click", function(e) {
        that.hide();
      });
    }

    initMenuItem(menuItems) {
      if (typeof menuItems !== "object" || !menuItems) return;

      if (menuItems.hasOwnProperty("style")) {
        for (const key in menuItems["style"]) {
          this.menus.style[key] = menuItems["style"].key;
        }
      }

      if (menuItems.hasOwnProperty("items")) {
        const that = this;
        const items = menuItems.items;
        for (const index in items) {
          const item = items[index];
          const menu = document.createElement("li");
          menu.classList.add("context-menu-item");
          switch (item.type) {
            case "menu":
              menu.appendChild(document.createElement("span")).appendChild(document.createTextNode(item.title));
              if (item.hasOwnProperty("onclick") && typeof item.onclick === "function") {
                menu.addEventListener("click", event => {
                  item.onclick(event, that.selector);
                  that.hide();
                });
              }
              this.menus.appendChild(menu);
              break;
            case "submenu":
              menu.classList.add("context-menu-submenu");
              menu.appendChild(document.createElement("span")).appendChild(document.createTextNode(item.title));
              this.menus.appendChild(menu);
              break;
            case "separator":
              menu.classList.add("context-menu-separator");
              this.menus.appendChild(menu);
              break;
          }
        }
      }
    }

    show(x, y) {
      this.menus.style.top = "-50%";
      this.menus.style.display = "block";
      if (y + this.menus.clientHeight > window.innerHeight - 10) {
        y -= this.menus.clientHeight + 10;
      }
      if (x + this.menus.clientWidth > window.innerWidth - 10) {
        x -= this.menus.clientWidth + 10;
      }
      x += window.pageXOffset;
      y += window.pageYOffset;
      this.menus.style.left = x + "px";
      this.menus.style.top = y + "px";
    }

    hide() {
      this.menus.style.display = "none";
    }
  }

  class PreviewHtml {
    /**
     * This PreviewHtml should be initialized when the html dom is loaded.
     */
    constructor(isVscode) {
      this.vscodeAPI = null;
      this.sourceUri = "";
      this.totalLines = 0;
      this.currentLine = -1;
      this.syncScrollTop = -1;
      this.config = { vscode: isVscode };
      const previewElement = document.createElement("div");
      previewElement.classList.add("workspace-container");
      this.previewElement = previewElement;
      document.body.appendChild(this.previewElement);
      this.initWindowEvents();
      this.initMenus();
      previewer.init();
    }

    initMenus() {
      const that = this;
      const menuItems = {
        style: {
          width: "210px",
          zIndex: "1",
          display: "none"
        },
        items: [
          {
            type: "menu",
            title: "用浏览器打开",
            onclick: function(e, s) {
              that.postMessage("openInBrowser", [
                { type: "br", content: previewer.brEncode(s.innerHTML) },
                document.title,
                that.sourceUri,
                that.markdown_types
              ]);
            }
          },
          {
            type: "menu",
            title: "导出 -> HTML",
            onclick: function(e, s) {
              that.postMessage("exportHTML", [
                { type: "br", content: previewer.brEncode(s.innerHTML) },
                document.title,
                that.sourceUri,
                that.markdown_types
              ]);
            }
          },
          {
            type: "menu",
            title: "导出 -> PDF",
            onclick: function(e, s) {
              that.postMessage("exportPDF", [
                { type: "br", content: previewer.brEncode(s.innerHTML) },
                document.title,
                that.sourceUri,
                that.markdown_types
              ]);
            }
          }
        ]
      };

      this.contextMenu = new ContextMenu(this.previewElement, menuItems);
    }

    /**
     * Post message to parent window
     * @param command
     * @param args
     */
    postMessage(command, args = []) {
      if (this.config.vscode) {
        if (!this.vscodeAPI) {
          // @ts-ignore
          this.vscodeAPI = acquireVsCodeApi();
        }
        // post message to vscode
        this.vscodeAPI.postMessage({
          command,
          args
        });
      } else {
        window.parent.postMessage(
          {
            command,
            args
          },
          "file://"
        );
      }
    }

    /**
     * Initialize several `window` events.
     */
    initWindowEvents() {
      /**
       * Several keyboard events.
       */
      window.addEventListener("keydown", event => {
        if (event.shiftKey && event.ctrlKey && event.which === 83) {
          // ctrl+shift+s preview sync source
          return this.previewSyncSource();
        }
        // else if (event.metaKey || event.ctrlKey) {
        //   // ctrl+c copy
        //   if (event.which === 67) {
        //     // [c] copy
        //     document.execCommand("copy");
        //   } else if (event.which === 187 && !this.config.vscode) {
        //     // [+] zoom in
        //     this.zoomIn();
        //   } else if (event.which === 189 && !this.config.vscode) {
        //     // [-] zoom out
        //     this.zoomOut();
        //   } else if (event.which === 48 && !this.config.vscode) {
        //     // [0] reset zoom
        //     this.resetZoom();
        //   } else if (event.which === 38) {
        //     // [ArrowUp] scroll to the most top
        //     if (this.presentationMode) {
        //       window["Reveal"].slide(0);
        //     } else {
        //       this.previewElement.scrollTop = 0;
        //     }
        //   }
        // } else if (event.which === 27) {
        //   // [esc] toggle sidebar toc
        //   this.escPressed(event);
        // }
      });
      //window.onscroll = this.scrollEvent.bind(this);
      window.addEventListener("scroll", event => {
        this.scrollEvent(event);
      });
      window.addEventListener("message", event => {
        this.messageEvent(event);
      });
      window.addEventListener("wasm", event => {
        if (event.detail.name === "wasm_brotli_browser_bg.wasm") {
          this.postMessage("webviewLoaded", [document.title]);
        }
      });
    }

    updateMarkdown(markdown) {
      const that = this;
      this.previewElement.innerHTML = previewer.makeHtml(markdown, types => {
        that.markdown_types = types;
      });
    }

    messageEvent(event) {
      const message = event.data;
      if (message) {
        console.log(message);
        switch (message.command) {
          case "updateMarkdown":
            this.sourceUri = message.uri;
            this.updateMarkdown(message.markdown);
            if (message.title) {
              document.title = message.title;
            }
            this.totalLines = message.totalLines;
            this.scrollToLine(message.currentLine);
            break;
          case "changeTextEditorSelection":
            const line = parseInt(message.line, 10);
            let topRatio = parseFloat(message.topRatio);
            if (isNaN(topRatio)) {
              topRatio = 0.372;
            }
            this.scrollToLine(line, topRatio);
            break;
        }
      }
    }

    scrollEvent(event) {
      console.log(`scrolltop: ${window.scrollY}-${this.syncScrollTop}`);
      if (this.syncScrollTop >= 0) {
        if (window.scrollY === this.syncScrollTop) {
          this.syncScrollTop = -1;
        }
      } else {
        this.previewSyncSource();
      }
    }

    previewSyncSource() {
      let scrollLine = 0;
      if (window.scrollY !== 0) {
        if (window.scrollY + window.innerHeight >= this.previewElement.scrollHeight) {
          scrollLine = this.totalLines;
        } else {
          const top = window.scrollY + window.innerHeight / 2;
          scrollLine = parseInt((top * this.totalLines) / this.previewElement.scrollHeight, 10);
        }
      }
      this.postMessage("revealLine", [this.sourceUri, scrollLine]);
    }

    scrollToLine(line, ratio = 0.372) {
      if (line !== this.currentLine) {
        this.currentLine = line;
        if (this.totalLines) {
          let scrollTop = 0;
          if (line + 1 === this.totalLines) {
            scrollTop = this.previewElement.scrollHeight;
          } else {
            scrollTop = parseInt((line * this.previewElement.scrollHeight) / this.totalLines, 10);
            //Math.max(scrollTop - this.previewElement.offsetHeight * ratio, 0);
          }
          this.syncScrollTop = scrollTop;
          window.scroll({
            left: 0,
            top: scrollTop,
            behavior: "smooth"
          });
        }
      }
    }
  }

  function onLoad() {
    if (typeof window.mdsp === "object" && window.mdsp) {
      window.mdsp.phtml = new PreviewHtml(false);
    } else {
      new PreviewHtml(true);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onLoad);
  } else {
    onLoad();
  }
})(showdowns);
