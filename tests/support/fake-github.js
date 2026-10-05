// In-memory fakes for every external HTTP service the recipe functions call,
// installed with nock at the Node http/https layer. The functions' own
// GitHub and build-hook client code (netlify/functions/_shared/github.js,
// buildHook.js) runs unmodified; only the network endpoint is fake.
//
//   raw.githubusercontent.com   all-recipes.json reads (list/detail/preview)
//   api.github.com              Contents API GET/PUT, branch HEAD lookup
//   api.netlify.com             build hook POST
//
// nock.disableNetConnect() is on for the whole process: any request to a
// host not faked here (the real GitHub, Netlify, Neon, Clover) fails the
// call instead of leaving the machine.
const crypto = require('crypto');
const nock = require('nock');

const REPO = 'SirEvelyn0116/shehirian-modular';
const RECIPES_PATH = 'sections/recipes/all-recipes.json';

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function createFakeServices({ branch, token, buildHookId }) {
  const state = {
    content: '',
    blobSha: '',
    headSha: '',
    commits: [],
    buildHooks: 0,
    rawReads: 0,
    failNextPut: null, // { status, message } to make the next commit fail
  };

  function setRecipes(json) {
    state.content = JSON.stringify(json, null, 2);
    state.blobSha = sha1(state.content);
    state.headSha = sha1(`head:${state.content}:${state.commits.length}`);
  }

  function reset(json) {
    state.commits = [];
    state.buildHooks = 0;
    state.rawReads = 0;
    state.failNextPut = null;
    setRecipes(json);
  }

  function currentRecipes() {
    return JSON.parse(state.content);
  }

  const authOk = (req) => req.headers.authorization === `token ${token}`;
  const contentsPath = `/repos/${REPO}/contents/${encodeURIComponent(RECIPES_PATH)}`;

  function install() {
    nock.disableNetConnect();
    nock.enableNetConnect((host) => host.startsWith('127.0.0.1') || host.startsWith('localhost'));

    nock('https://raw.githubusercontent.com')
      .persist()
      .get(`/${REPO}/${branch}/${RECIPES_PATH}`)
      .query(true)
      .reply(() => {
        state.rawReads++;
        return [200, state.content];
      });

    nock('https://api.github.com')
      .persist()
      .get(contentsPath)
      .query({ ref: branch })
      .reply(function () {
        if (!authOk(this.req)) return [401, { message: 'Bad credentials' }];
        return [200, { sha: state.blobSha, content: Buffer.from(state.content).toString('base64') }];
      })
      .put(contentsPath)
      .reply(function (_uri, body) {
        if (!authOk(this.req)) return [401, { message: 'Bad credentials' }];
        if (state.failNextPut) {
          const { status, message } = state.failNextPut;
          state.failNextPut = null;
          return [status, { message }];
        }
        if (body.branch !== branch) return [422, { message: `unexpected branch ${body.branch}` }];
        // Same optimistic-concurrency rule as GitHub: the PUT must name the
        // blob it is replacing.
        if (body.sha !== state.blobSha) return [409, { message: 'sha does not match' }];
        const content = Buffer.from(body.content, 'base64').toString('utf8');
        state.commits.push({ message: body.message, branch: body.branch, content });
        state.content = content;
        state.blobSha = sha1(content);
        state.headSha = sha1(`commit:${state.commits.length}:${content}`);
        return [200, { commit: { sha: state.headSha } }];
      })
      .get(`/repos/${REPO}/commits/${encodeURIComponent(branch)}`)
      .reply(function () {
        if (!authOk(this.req)) return [401, { message: 'Bad credentials' }];
        return [200, { sha: state.headSha }];
      });

    nock('https://api.netlify.com')
      .persist()
      .post(`/build_hooks/${buildHookId}`)
      .reply(() => {
        state.buildHooks++;
        return [200, ''];
      });
  }

  return { state, install, reset, setRecipes, currentRecipes };
}

module.exports = { createFakeServices, REPO, RECIPES_PATH };
