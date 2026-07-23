(function () {
  var placeholder = document.getElementById('site-footer');
  if (!placeholder) return;
  fetch('/footer.html', { cache: 'no-store' })
    .then(function (response) { return response.text(); })
    .then(function (html) { placeholder.outerHTML = html; })
    .catch(function () {});
})();
