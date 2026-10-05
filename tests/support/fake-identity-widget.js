// Served in place of https://identity.netlify.com/v1/netlify-identity-widget.js
// during the browser tests. Implements the part of the widget's API the
// admin pages use: currentUser(), user.jwt(), user.token.access_token and
// the 'init' / 'login' events (fired asynchronously, as the real widget does
// when it restores a session). The signed-in user comes from
// window.__TEST_IDENTITY__, set by the test before the page loads.
(function () {
  var identity = window.__TEST_IDENTITY__ || null;
  function user() {
    if (!identity) return null;
    return {
      email: identity.email,
      app_metadata: { roles: identity.roles },
      token: { access_token: identity.token },
      jwt: function () {
        return Promise.resolve(identity.token);
      },
    };
  }
  window.netlifyIdentity = {
    currentUser: user,
    on: function (event, callback) {
      if (event === 'init' || (event === 'login' && identity)) {
        setTimeout(function () {
          callback(user());
        }, 0);
      }
    },
    off: function () {},
    open: function () {},
    close: function () {},
    logout: function () {},
  };
})();
