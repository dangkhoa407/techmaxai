const extensionAttributePrefixes = ["bis_", "__processed_"];

function isExtensionAttribute(name: string) {
  return extensionAttributePrefixes.some((prefix) => name.startsWith(prefix));
}

function cleanExtensionAttributes(node: Node) {
  if (!(node instanceof Element)) return;

  for (const attribute of Array.from(node.attributes)) {
    if (isExtensionAttribute(attribute.name)) {
      node.removeAttribute(attribute.name);
    }
  }

  for (const child of Array.from(node.children)) {
    cleanExtensionAttributes(child);
  }
}

if (typeof window !== "undefined") {
  cleanExtensionAttributes(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName && isExtensionAttribute(mutation.attributeName)) {
        (mutation.target as Element).removeAttribute(mutation.attributeName);
      }

      for (const node of Array.from(mutation.addedNodes)) {
        cleanExtensionAttributes(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
}
