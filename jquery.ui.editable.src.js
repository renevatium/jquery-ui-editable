(function($, undefined){

  var selection = {}, popup = {};
  var div = "<div></div>", span = "<span></span>", anchor = "<a></a>", label = "<label></label>",
    textarea = "<textarea></textarea>", input = "<input></input>", canvas = "<canvas></canvas>", img = "<img></img>";

  $.widget("ui.editable", {

    activeState: "text",
    widgetEventPrefix: "editable",
    options: { width: '100%', height: null, resizeX: false, resizeY: true, mediaUrl: null, colors: [ "#000000" ],
      tasks: [ "bold,italic,underline,strike,|,left,center,right,justify,|,color,format,font,fontsize,|,ul,ol,|,link,unlink,media,|,fullscreen,code" ],
    },

    blockformats: { "#text": "Paragraph", pre: "Preformatted", h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", h4: "Heading 4", h5: "Heading 5", h6: "Heading 6" },
    fonts: [ "Arial", "Book Antiqua", "Calibri", "Comic Sans MS", "Courier", "Georgia", "Impact", "Lucida Console", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana" ],
    fontsizes: [ "10px", "11px", "12px", "13px", "14px", "16px", "18px", "24px", "36px", "48px" ],
    actions: {
      bold: "Bold", italic: "Italic", underline: "Underline", strike: "StrikeThrough", left: "align", center: "align",
      right: "align", justify: "align", color: "color", format: "format", font: "font", fontsize: "fontsize", ul: "InsertUnorderedList",
      ol: "InsertOrderedList", link: "link", unlink: "unlink", media: "media", fullscreen: "fullscreen", code: "code"
    },

    _create: function(){
      this.initialize();
    },

    destroy: function(){
      this.value();
      this.container.remove();
      this.element.show();
      $.Widget.prototype.destroy.call(this);
    },

    _setOption: function(key, value){
      $.Widget.prototype._setOption.apply(this,arguments);
    },

    value: function(){
      this.element.val(this.document.html());
      return this.element.val();
    },

    initialize: function(){
      var t = this, o = t.options;
      if(o.height == null){ o.height = this.element.parent().height(); }
      t.height = o.height; t.width = o.width;
      if(t.options.colors.length > 5) t.options.colors.splice(0, 5);
      var fonts = {}; $.each(t.fonts, function(i, name){
        fonts[name.toLowerCase()] = name;
      }); t.fonts = fonts;
      var sizes = {}; $.each(t.fontsizes, function(i, name){
        sizes[name] = name;
      }); t.fontsizes = sizes;
      t.element.parents("form").bind("submit", function(e){ t.value(); });
      t.element.hide();
      t.construct();
    },

    construct: function(){
      var t = this, e = this.element;
      t.container = $(div).addClass("editable").insertBefore(e);
      t.document = $(div).addClass("document").attr({ spellcheck: false }).appendTo(this.container);
      t.source = $(textarea).addClass("source").attr({ spellcheck: false }).appendTo(this.container);
      t.statusbar = $(div).addClass("statusbar").appendTo(t.container);
      t.handle = $(span).addClass("resize").appendTo(t.statusbar);
      t.wordcount = $(span).addClass("review").appendTo(t.statusbar);
      t.taskbar = $(div).addClass("taskbar").prependTo(t.container);
      t.document.html(this.element.val()).attr({ contentEditable: true });
      if(typeof InstallTrigger !== 'undefined'){
        document.execCommand("enableInlineTableEditing", false, false);
        document.execCommand("enableObjectResizing", false, false);
      }
      t.position();
      t.controls();
    },

    position: function(){
      this.container.width(this.width);
      this.source.width(this.document.width());
      this.document.height(this.height);
      this.source.height(this.document.height());
    },

    controls: function(){
      var t = this;
      t.document.bind("paste", function(e){ t.paste(); });
      t.document.bind("keyup mouseup", function(e){ t.query(); });
      t.source.bind("keydown", function(e){
        if(e.which == 9){ selection.insertText(e.target, "\t"); e.preventDefault(); }
      });
      t.handle.bind("mousedown", function(e){ t.resize(e); e.preventDefault(); });
      if(!t.options.resizeX && !t.options.resizeY) t.handle.hide();
      $(window).bind("resize", function(){ t.position(); });
      popup.onopen = function(){ selection.saveSelection(); };
      popup.onclose = function(){ t.document.focus(); selection.restoreSelection(); };
      t.commands();
    },

    commands: function(){
      var t = this;
      $.each(t.options.tasks, function(row, actions){
        var g = $(span).addClass("group").appendTo(t.taskbar);
        actions = $.trim(actions).replace(/(\s*,\s*)/gi,',').split(",");
        $.each(actions, function(col, code){
          if(t.actions[code]){
            var command = t.actions[code];
            $(anchor).attr({ href:code }).addClass("task "+code).appendTo(g).bind("click", function(e){
              e.preventDefault(); t.exec(command, null, code);
            });
          } else $(span).addClass("space").appendTo(g)
        });
      });
      t.taskbar.append($(span).addClass("end"));
      t.taskbar.find("a.color").append($(span).addClass('value'));
      t.taskbar.find(".group:gt(0)").css({ clear: 'left' });
      t.populate();
    },

    exec: function(command, value, code){
      this.document.focus();
      try{ this[command](code);
      }catch(e){
        try{ document.execCommand(command, false, value);
        }catch(e){
          console.log(e);
          if(e.result == 2147500037){
            this.document.prepend('<div rel="clean"></div>');
            document.execCommand(command, false, null);
            this.document.find("[rel='clean']").remove();
          }
        }
      }
      this.document.focus();
      this.query();
    },

    css: function(name){
      if(selection.hasParent()){
        var node = selection.parentNode() || selection;
        if(node.nodeName == "#text") node = node.parentNode;
        return $(node).css(name);
      }
    },

    style: function(name, value){
      var node = selection.parentNode();
      if(node.nodeName == "#text" || node.textContent != selection.textContent()){
        if(node.nodeName != "#text" && $(node).css(name) == value) return;
        node = $(span).html(selection.textContent()).get(0);
        selection.insertNode(node).selectNodeContents(node);
      }
      $(node).css(name, value);
    },

    surround: function(tag){
      var node = selection.parentNode();
      if(node.nodeName.toLowerCase() != tag){
        if(node.nodeName.toLowerCase() != "#text") selection.selectNode(node);
        if(tag == "#text") node = document.createTextNode(selection.textContent());
        else node = $("<"+tag+"></"+tag+">").html(selection.textContent()).get(0);
        selection.insertNode(node).selectNodeContents(node);
      }
    },

    populate: function(){
      var t = this;
      this.dropdown("format", this.blockformats, "Paragraph", function(value){ t.surround(value); });
      this.dropdown("font", this.fonts, "Font", function(value){ t.style("font-family", value); });
      this.dropdown("fontsize", this.fontsizes, "13px", function(value){ t.style("font-size", value); });
      this.review();
    },

    dropdown: function(className, values, value, callback){
      var t = this;
      t.taskbar.find("."+className).addClass("dropdown").append($(span).addClass('value').html(value))
        .append($(span).addClass('select')).append($(span).addClass('values').hide());
      $.each(values, function(value, name){
        var select = t.taskbar.find("."+className+" .values");
        var option = $(span).html(name).click(function(e){
          e.preventDefault();
          e.stopPropagation();
          callback(value);
          t.taskbar.find("."+className+" .value").html(name);
          $(this).parents(".values").hide();
          t.document.focus();
        }).appendTo(select);
      });
      selection.clearSelection();
    },

    query: function(){
      var t = this;
      if(t.activeState == "text"){
        $.each(t.actions, function(code, command){
          try{ var state = document.queryCommandState(command); t.toggle(code, state); }catch(e){ }
        });
        try{
          t.toggle("link", selection.hasParent("a"));
          t.taskbar.find(".color .value").css("backgroundColor", t.css("color"));
          t.taskbar.find(".font .value").html(t.fonts[t.css("font-family")]);
          t.taskbar.find(".fontsize .value").html(t.css("font-size"));
          if(selection.hasParent()){
            var format = selection.parentNode().nodeName.toLowerCase();
            var formatBlock = (t.blockformats[format]) ? t.blockformats[format] : "Paragraph";
            t.taskbar.find(".format .value").html(formatBlock);
          }
        }catch(e){
          console.error(e);
        }
      }
      t.review();
    },

    toggle: function(task, state){
      task = task.toLowerCase();
      if(state) this.taskbar.find("."+task).addClass("active");
      else this.taskbar.find("."+task).removeClass("active");
    },

    review: function(){
      var node = this.document.get(0);
      var text = (node.textContent) ? node.textContent : node.innerText;
      var words = $.trim(text).split(/\s+/).length;
      this.wordcount.html(words + " Words");
    },

    code: function(){
      this.taskbar.find(".code").toggleClass("active");
      if(this.activeState == "code" && (this.activeState = "text")){
        this.source.hide();
        this.document.html(this.source.val()).show();
        this.taskbar.find(".task,.space").not(".code").show();
      }else if(this.activeState == "text" && (this.activeState = "code")){
        this.document.hide();
        this.source.val(this.syntax(this.document.html())).show();
        this.taskbar.find(".task,.space").not(".code").hide();
      }
      this.container.toggleClass("sourcecode");
    },

    syntax: function(html){
      html = html.replace(/\s+/g, ' ')
        .replace(/([^<]{50,100} )/g, "$1\r\n")
        .replace(/>([^<]{50,100} )/g, ">\r\n$1");
      return $.trim(html);
      /*html = $(div).html(html).find("*").each(function(){
        if($(this).html().length > 50){
          $(this).before("\r\n").after("\r\n").prepend("\r\n").append("\r\n");
        }else if($(this).is("p,div,h1,h2,h3,h4,hr,table,tbody,thead,tfoot,tr")){
          $(this).before("\r\n").after("\r\n");
        }
      }).end().html().replace(/(<[^/>]+><[^/>]+>)/g, "\r\n$1").replace(/(.*)(\r\n|\n|\r)/g, function(match, prefix){
        return ($.trim(prefix).length > 0) ? match.replace(/^\s+/mg, "") : "";
      });*/
      return $.trim(this.indent(html));
    },

    indent: function(html){
      var t = this, pad = "\t";
      var container = $(div).html(html);
      container.children().not("br").each(function(){
        var source = $(this).html();
        var lines = source.match(/^(.+)$/mg);
        if((lines && lines.length > 1) || source.length >= 100){
          source = source.replace(/^(.+)$/mg, function(match){
            return ($.trim(match).length > 0) ? pad+match : match;
          });
        }
        $(this).html(t.indent(source, pad));
      });
      return container.html();
    },

    fullscreen: function(){
      this.container.toggleClass("fullscreen");
      this.taskbar.find(".fullscreen").toggleClass("active");
      if(this.container.hasClass("fullscreen")){
        var width = $(document).width(), height = $(document).height();
        this.container.width(width);
        this.document.height(height-70);
        this.source.width(this.document.width());
        this.source.height(this.document.height());
      }else this.position();
    },

    align: function(direction){
      var node = selection.parentNode();
      if(node.nodeName == "#text"){
        selection.selectNode(node);
        node = $(div).html(selection.textContent()).get(0);
        selection.insertNode(node).selectNodeContents(node);
      }
      $(node).css("text-align", direction);
    },

    link: function(){
      var t = this, node = false;
      if(selection.hasParent("a")) node = selection.parentNode("a");
      var value = $(input).attr("type", "text").addClass("href").val((node) ? $(node).attr("href") : "");
      var data = $(div).addClass("links").append($(label).html("Destination URL")).append(value);
      var actions = $(div).append($(input).attr("type", "button").val("Cancel").click(function(){ popup.close(); }))
        .append($(input).attr("type", "button").val("Okay").click(function(){ popup.close();
          if(node){
            $(node).attr({ href: value.val(), target: "_blank" });
          }else{
            t.exec("CreateLink", value.val());
            t.container.find('a:not([target])').attr({ target: "_blank" });
          }
          t.toggle("link", true);
        }));
      popup.open(data, actions);
    },

    unlink: function(){
      var node = selection.parentNode("a");
      selection.selectNode(node);
      this.exec("Unlink", null);
      this.toggle("link", false);
    },

    format: function(){ this.select("format"); },
    font: function(){ this.select("font"); },
    fontsize: function(){ this.select("fontsize"); },

    select: function(className){
      var task = this.taskbar.find("."+className);
      if(task.find(".values:visible").length == 0){
        this.taskbar.find(".dropdown .values").hide();
        task.find(".values").show();
        $(document).bind("click.editable", function(e){
          if($(e.target).closest("."+className).length == 0){
            task.find(".values").hide();
            $(document).unbind("click.editable");
          };
        });
      } else {
        $(document).unbind("click.editable");
        task.find(".values").hide();
      }
    },

    paste: function(){
      var t = this;
      selection.saveSelection();
      var temp = $(div).addClass("paste").appendTo(t.document);
      var node = $(div).appendTo(temp);
      selection.selectNode(node.get(0));
      window.setTimeout(function(){
        var node = t.clean(temp.html());
        temp.remove();
        selection.restoreSelection();
        t.document.focus();
        selection.insertNode(node);
        selection.selectNode(node);
      }, 0);
    },

    clean: function(data){
      data = data.replace(/\s+/g, ' ').replace(/\<(\/|)(br|p)([^/>]*)(\/|)\>/g, '<br />\r\n');
      data = data.replace(/\<b style([^>]*)\>/g, '%strong%').replace(/\<\/b[^r]*>/g, '%/strong%');
      var text = $.trim($(div).html(data).text()).replace(/\r\n|\r|\n/g, '<br />').replace(/%(\/|)strong%/g, "<$1strong>");
      return $(span).html(text).get(0);
    },

    color: function(){
      var t = this, hue = $(canvas).addClass("box hue").attr({ width: 248, height: 18 });
      var shade = $(canvas).addClass("box shade").attr({ width: 248, height: 18 });
      var preview = $(span).addClass("preview"), colors = $(div).addClass("defaults");
      var value = $(input).attr("type", "text").addClass("hex");
      var data = $(div).addClass("colors").append(hue).append(shade).append(preview).append(colors).append(value);
      var actions = $(div).append($(input).attr("type", "button").val("Cancel").click(function(){ popup.close(); }))
        .append($(input).attr("type", "button").val("Okay").click(function(){
          popup.close(); t.exec("foreColor", value.val());
          if($.inArray(value.val(), t.options.colors) < 0) t.options.colors.push(value.val());
          if(t.options.colors.length > 5) t.options.colors.shift();
        }));
      $.each(t.options.colors, function(i, color){
        $(span).addClass("preview").css("backgroundColor", color).appendTo(colors).bind("click", function(){
          hue.changeColor(color);
        });
      });
      var hueContext = hue.get(0).getContext('2d');
      var shadeContext = shade.get(0).getContext('2d');
      var image = new Image();
      image.src = 'images/hue.png';
      image.onload = function(){ hueContext.drawImage(image, 0, 0); };
      hue.changeColor = function(color){
        var shadeGradient = shadeContext.createLinearGradient(0, 0, 248, 18);
        shadeGradient.addColorStop(0, '#ffffff');
        shadeGradient.addColorStop(0.5, color);
        shadeGradient.addColorStop(1, '#000000');
        shadeContext.fillStyle = shadeGradient;
        shadeContext.fillRect(0, 0, 248, 18);
        preview.css("backgroundColor", color);
        value.val(color);
      };
      hue.bind('mousedown', function(){
        hue.bind('mousemove', function(e){
          var x = e.pageX - $(e.currentTarget).offset().left;
          var y = e.pageY - $(e.currentTarget).offset().top;
          var data = hueContext.getImageData(x, y, 1, 1).data;
          var hex = t.color2hex(data[0], data[1], data[2]);
          hue.changeColor(hex);
        });
      }).bind('mouseup', function(event){ hue.unbind("mousemove"); });
      shade.bind('mousedown', function(){
        shade.bind('mousemove', function(e){
          var x = e.pageX - $(e.currentTarget).offset().left;
          var y = e.pageY - $(e.currentTarget).offset().top;
          var data = shadeContext.getImageData(x, y, 1, 1).data;
          var hex = t.color2hex(data[0], data[1], data[2]);
          preview.css("backgroundColor", hex);
          value.val(hex);
        });
      }).bind('mouseup', function(event){ shade.unbind("mousemove"); });
      value.bind("keyup", function(){ preview.css("backgroundColor", value.val()); });
      hue.changeColor(this.color2hex(document.queryCommandValue("foreColor")));
      popup.open(data, actions);
    },

    color2hex: function(color){
      if(arguments.length == 3){
        return this.rgb2hex(arguments[0], arguments[1], arguments[2]);
      }else if(isNaN(color) && color.substr(0,1) == '#'){
        return color;
      }else if(isNaN(color) && color.substr(0,3) == 'rgb'){
        if((color = color.match(/([0-9]+)/g)) && color == null) color = [ 0, 0, 0 ];
        return this.rgb2hex(color[0], color[1], color[2]);
      }else if(/*@cc_on!@*/false || !!document.documentMode){
        value = (((color & 0x0000ff) << 16) | (color & 0x00ff00) | ((color & 0xff0000) >>> 16));
        return "#" + ("000000" + value.toString(16)).slice(-6);
      }
    },

    rgb2hex: function(r, g, b){
      return "#" + this.dec2hex(r) + this.dec2hex(g) + this.dec2hex(b)
    },

    dec2hex: function(n){
      if((n = parseInt(n)) && (n == null || n == 0 || isNaN(n))) return "00";
      n = Math.round(Math.min(Math.max(0, n), 255));
      return "0123456789ABCDEF".charAt((n-n%16)/16) + "0123456789ABCDEF".charAt(n%16);
    },

    media: function(){
      var t = this;
      if(this.options.mediaUrl != null){
        var actions = $(div).append($(input).attr("type", "button").val("Cancel").click(function(){ popup.close(); }))
          .append($(input).attr("type", "button").val("Okay").click(function(){
            popup.close(); selection.insertNode($(img).attr({ "src": popup.window.find(".selected").attr("href") }).get(0));
          }));
        $.get(t.options.mediaUrl, function(data){
          $("a[rel='dir']").live("click.media", function(e){ e.preventDefault();
            $.get($(this).attr("href"), function(data){ popup.data(data, function(){}); });
          });
          $("a[rel='img']").live("click.media", function(e){ e.preventDefault();
            popup.window.find(".selected").removeClass("selected");
            $(this).addClass("selected");
          });
          popup.open(data, actions);
        });
      }
    },

    resize: function(event){
      var t = this, startX = event.pageX, startY = event.pageY;
      t.handle.unbind("mousedown");
      $(document).bind("mousemove", function(e){
        if(t.options.resizeX) t.width += e.pageX - startX;
        if(t.options.resizeY) t.height += e.pageY - startY;
        startX = e.pageX; startY = e.pageY;
        t.position();
      }).bind("mouseup", function(){
        $(document).unbind("mousemove").unbind("mouseup");
        t.handle.bind("mousedown", function(e){ t.resize(e); e.preventDefault(); })
      });
    }

  });

  $.extend(popup, {

    window: null, lightbox: null,
    onopen: function(){}, onclose: function(){},

    open: function(data, actions){
      this.lightbox = $(div).addClass("lightbox").appendTo("body");
      this.window = $(div).addClass("popbox").appendTo("body").append($(div).addClass("data").html(data))
        .append($(div).addClass("actions").html(actions)).alignCenter();
      this.onopen();
    },

    data: function(data){
      this.window.find(".data").html(data);
      this.window.alignCenter();
    },

    close: function(){
      this.window.remove();
      this.lightbox.remove();
      this.onclose();
    }

  });

  $.extend(selection, {

    insertText: function(node, text){
      var start = node.selectionStart;
      var begin = $(node).val().substr(0, start);
      var end = $(node).val().substr(node.selectionEnd);
      $(node).val(begin + text + end);
      node.selectionStart = start + 1;
      node.selectionEnd = start + 1;
    },

    insertNode: function(node, wrap){
      var range = window.getSelection().getRangeAt(0);
      if(wrap == true){
        if(range.extractContents) node.appendChild(range.extractContents());
        else $(node).append(range.text);
      }
      else range.deleteContents();
      if(range.insertNode) range.insertNode(node);
      else if(range.pasteHTML) range.pasteHTML($(node).outerHtml());
      return this;
    },

    selectNode: function(node){
      window.getSelection().removeAllRanges();
      var range = document.createRange();
      range.selectNode(node);
      window.getSelection().addRange(range);
      return this;
    },

    selectNodeContents: function(node){
      window.getSelection().removeAllRanges();
      var range = document.createRange();
      range.selectNodeContents(node);
      window.getSelection().addRange(range);
      return this;
    },

    containsNode: function(node){
      for(i=0;i<window.getSelection().rangeCount;i++){
        var source = window.getSelection().getRangeAt(i);
        var range = document.createRange();
        range.selectNode(node);
        var first = range.compareBoundaryPoints(Range.START_TO_END, source);
        var second = source.compareBoundaryPoints(Range.START_TO_END, range);
        if(first == 1 && second == 1) return true;
      }
      return false;
    },

    hasParent: function(tag){
      if(window.getSelection().rangeCount > 0){
        node = window.getSelection().getRangeAt(0).commonAncestorContainer;
        while(node && node.nodeName.toLowerCase() != tag && !$(node).is(".document")) node = node.parentNode;
        return !$(node).is(".document");
      }
      return false;
    },

    parentNode: function(tag){
      node = window.getSelection().getRangeAt(0).commonAncestorContainer;
      if(tag) while(node.nodeName.toLowerCase() != tag && !$(node).is(".document")) node = node.parentNode;
      else while(node.nodeName.toLowerCase() == "#text") node = node.parentNode;
      return ($(node).is(".document")) ? node.childNodes[0] : node;
    },

    textContent: function(){
      return window.getSelection().toString();
    },

    saveSelection: function(){
      this.ranges = [];
      for(i=0;i<window.getSelection().rangeCount;i++){
        this.ranges.push(window.getSelection().getRangeAt(i).cloneRange());
      }
      window.getSelection().removeAllRanges();
      return this;
    },

    restoreSelection: function(){
      window.getSelection().removeAllRanges();
      for(i=0;i<this.ranges.length;i++) window.getSelection().addRange(this.ranges[i]);
      return this;
    },

    clearSelection: function(){
      window.getSelection().removeAllRanges();
      return this;
    }

  });

  if(!window.getSelection){
    $.extend(window, {
      getSelection: function(){
        if(document.selection.getRangeAt == undefined){
          $.extend(document.selection, {
            getRangeAt: function(i){
              var range = document.selection.createRange();
              range.commonAncestorContainer = (range.parentElement) ? range.parentElement() : range(i);
              return range;
            }
          });
        }
        return document.selection;
      }
    });
  }

  $.fn.outerHtml = function(){
    return $(div).append(this).html();
  };

  $.fn.alignCenter = function(){
    this.css("top", Math.max((($(window).height() - this.outerHeight())/2) + $(window).scrollTop(), "20") + "px");
    this.css("left", Math.max((($(window).width() - this.outerWidth())/2) + $(window).scrollLeft(), "20") + "px");
    return this;
  };

  $.extend(Function.prototype, { //http://parentnode.org/javascript/default-arguments-in-javascript-functions/
    defaults: function(){
      var _f = this, _a = Array(_f.length-arguments.length).concat(Array.prototype.slice.apply(arguments));
      return function(){
        return _f.apply(_f, Array.prototype.slice.apply(arguments).concat(_a.slice(arguments.length, _a.length)));
      }
    }
  });

})(jQuery);
