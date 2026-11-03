/* App boot: check the session, load the public content, draw the first page */
(async () => {
  await Promise.all([loadMe(), loadPublic()]);
  render();
})();
