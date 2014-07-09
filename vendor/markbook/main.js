$(function() {

  var defaultUri = 'README.md';
  var defaultContainer = $('#content');

  var navigationUri = 'SUMMARY.md';
  var navigationContainer = $('#nav');

  var initialUri = document.location.hash ? document.location.hash : defaultUri;
  var defaultFullPath = document.location.pathname + document.location.hash;
  var cache = {};

  // Initialize
  new Content(initialUri).render();
  new Content(navigationUri, navigationContainer).render();
  history.replaceState({ uri: defaultFullPath }, null, defaultFullPath);

  $(document).on('click', 'a', function (event) {
    var uri = new Uri($(this).attr('href'));

    if (uri.isRenderable()) {
      event.preventDefault();
      history.pushState({ uri: uri.value }, null, uri.value);
      new Content(uri.value).render();
    }
  });

  $(window).on('popstate', function (event) {
    var uri = new Uri(history.state.uri);

    if (uri.isRenderable()) {
      new Content(uri.value).render();
    }
  });

  function Content(path, container) {
    this.path = new Uri(path).hashToReal();
    this.container = typeof container !== 'undefined' ? container : defaultContainer;

    this.get = function() {
      if (this.path in cache && cache[this.path]) {
        this.value = cache[this.path];
        return $.Deferred().resolve(this.value);
      } else {
        return $.get(this.path);
      }
    };

    this.detectRenderer = function() {
      var renderer = 'unknown';
      var fileExtensionPattern = new RegExp('\.[0-9a-z]+$', 'i');
      var fileExtension = path.match(fileExtensionPattern);

      if (fileExtension != null && fileExtension.length > 0) {
        fileExtension = fileExtension[0].substr(1);

        switch (fileExtension) {
          case 'md':
          case 'markdown':
            renderer = 'markdown'
            break
        }
      }

      return renderer;
    };

    this.render = function() {
      var content = this;

      this.get()
        .done(function(data) {
          content.value = cache[content.path] = data;
        })
        .fail(function() {
          content.value = 'Error: This page is not available :(';
        }).
        always(function() {

          content.container.scrollTop(0);

          if (path == document.location.pathname) {
            new Content(initialUri).render();
          } else {
            var renderer = content.detectRenderer();
            renderer = 'render' + renderer[0].toUpperCase() + renderer.substring(1);
            content[renderer]();
          }
        });
    };

    this.renderMarkdown = function() {
      this.value = marked(this.value);
      this.container.html(this.processHtml());
    };

    this.renderUnknown = function() {
      this.container.html(marked("# Error\nSorry, I don't know how to render this page :("));
    };

    this.processHtml = function() {
      var html = $.parseHTML(this.value);
      var context = this.path;

      var resources = {
        'a': 'href',
        'img': 'src'
      };

      $.each(resources, function(tag, attr) {
        $.each($(tag, html), function(i, e) {
          var uri = new Uri($(this).attr(attr), context);
          $(this).attr(attr, uri.normalize());
        });
      });

      this.value = html;
      return html;
    };
  }

  function Uri(uri, context) {
    this.value = uri;
    this.context = ''

    context = typeof context == 'undefined' ? document.location.pathname : context;
    context = context.match(/(.*\/)/);

    if (context) {
      this.context = context[0];
    }

    this.normalize = function() {
      var uri = this.value;

      if (this.isRenderable()) {
        context = this.context.replace(document.location.pathname, '');
        uri =  '#!/' + context + uri;
      } else {
        if (!this.isExternal()) {
          uri = this.context + this.hashToReal();
        }
      }

      return uri;
    };

    this.hashToReal = function() {
      return this.value.replace(/#!\//g, '');
    };

    this.isExternal = function() {
      var extUriPattern = new RegExp('^(?:[a-z]+:)?//', 'i');
      return extUriPattern.test(this.value);
    };

    this.isRenderable = function() {
      var inPageAnchor = this.value.substr(0, 1) == '#' && this.value.substr(0, 3) != '#!/';
      var validRenderer = new Content(this.value).detectRenderer() != 'unknown';
      var front = this.value == document.location.pathname;

      return !this.isExternal()
              && !inPageAnchor
              && (front || validRenderer);
    };
  }
});
