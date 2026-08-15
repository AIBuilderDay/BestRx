"""AI features: catalog re-ranking and the agent that fills a cart from plain English.

Both live here rather than in the browser. The API key stays server-side, and the agent reaches the
catalog through this process's own MCP tools, so the model can only act on rows the store actually
holds.
"""
