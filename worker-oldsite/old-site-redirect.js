// dselectricalsw.co.uk → dselectricalsw.co.uk
// Every request 301s to the new site. Path-preserving where a
// matching page exists, otherwise to homepage.
//
// Deploys as Cloudflare Worker bound to route:
//   dselectricalsw.co.uk/*
//   www.dselectricalsw.co.uk/*

const NEW_ORIGIN = "https://www.dselectricalsw.co.uk";

// Known 1-to-1 path changes from the old Laravel site
const PATH_MAP = {
  "/about-us": "/about.html",
  "/contact-us": "/contact.html",
  "/services": "/#services",
  "/gallery": "/gallery.html",
  "/blog": "/blog.html",
};

export default {
  async fetch(request) {
    const u = new URL(request.url);
    const mapped = PATH_MAP[u.pathname.replace(/\/$/, "")];
    const target = NEW_ORIGIN + (mapped ?? u.pathname) + u.search;
    return Response.redirect(target, 301);
  },
};
