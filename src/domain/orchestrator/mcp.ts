import { McpAgent } from 'agents/mcp'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { State } from 'cloudflare/resources/cache/cache-reserve.mjs'
import { z } from 'zod'
import { aboutSlax } from '../../const/prompt'
import { BookmarkService } from '../bookmark'
import { container } from '../../decorators/di'
import { BookmarkContentNotFoundError, BookmarkNotFoundError } from '../../const/err'
import { SearchService } from '../search'
import { ContextManager } from '../../utils/context'
import { Hashid } from '../../utils/hashids'
import { ContentParser } from '../../utils/parser'

export type Props = {
  userId: number
  lang: string
}

export type BookmarkItem = { title: string; desc: string; byline: string; publishedTime: string; id: number }

export class SlaxMcpServer extends McpAgent<Env, State, Props> {
  server = new McpServer({
    name: 'Slax Reader MCP Server',
    version: '0.0.1'
  })

  async init() {
    // claude mcp add --transport sse slax_reader http://localhost:8787/v1/mcp/sse --header "authorization: "
    this.server.tool(
      'list_bookmark',
      'get bookmark list. when the `query` is empty, pagination is allowed with a fixed size of 5. When the `query` is not empty, 10 items are returned at once and pagination is not available.',
      {
        query: z.string().describe('search query term, default is empty'),
        page: z.number().describe('page number, default is 1')
      },
      async ({ query, page }: { query: string; page: number }) => {
        console.log('MCP search bookmark:', query, 'page:', page)
        const result: BookmarkItem[] = []
        const bmSvc = container.resolve(BookmarkService)
        const searchSvc = container.resolve(SearchService)
        const ctx = new ContextManager({} as ExecutionContext, this.env)

        ctx.setHashIds(new Hashid(this.env, this.props.userId))
        ctx.setUserInfo(this.props.userId, ctx.hashIds.encodeId(this.props.userId), '', this.props.lang)

        if (query === '') {
          const bmList = await bmSvc.bookmarkList(ctx, page, 10, 'all')
          bmList.forEach(bm => {
            result.push({
              title: bm.title,
              desc: bm.description || '',
              byline: bm.byline || '',
              publishedTime: bm.published_at ? bm.published_at.toISOString() : '',
              id: bm.id
            })
          })
        } else {
          const searchList = await searchSvc.hybridSearch(ctx, query)
          searchList.forEach(item => {
            result.push({
              title: item.highlight_title,
              desc: item.highlight_content,
              byline: '',
              publishedTime: '',
              id: item.bookmark_id
            })
          })
        }

        return {
          content: [
            { type: 'text', text: `find ${result.length} bookmark` },
            ...result.map(item => ({
              type: 'resource' as const,
              resource: {
                text: '',
                uri: `bookmark://content/${item.id}`,
                _meta: {
                  title: item.title,
                  description: item.desc,
                  byline: item.byline,
                  publishedTime: item.publishedTime,
                  tags: [],
                  overview_link: `bookmark://overview/${item.id}`
                }
              }
            }))
          ]
        }
      }
    )

    this.server.registerResource(
      'bookmark_overview',
      'bookmark://overview/{bookmark_id}',
      {
        title: 'Bookmark Overview',
        description: 'Overview of a specific bookmark',
        mimeType: 'text/plain'
      },
      async (uri: URL) => {
        const bookmarkId = this.extractBookmarkId(uri)
        const bmSvc = container.resolve(BookmarkService)
        try {
          const summary = await bmSvc.getUserBookmarkSummaryByMCP(bookmarkId, this.props.userId, this.props.lang)
          return {
            contents: [{ uri: uri.href, text: summary?.content || '' }]
          }
        } catch (e) {
          console.error(e)
          return {
            contents: [{ uri: uri.href, text: 'error' }]
          }
        }
      }
    )

    this.server.registerResource(
      'bookmark_content',
      new ResourceTemplate('bookmark://content/{bookmark_id}', {
        list: undefined
      }),
      {
        title: 'Bookmark Content',
        description: 'Content of a specific bookmark',
        mimeType: 'text/plain'
      },
      async (uri: URL) => {
        const bmId = this.extractBookmarkId(uri)
        const bmSvc = container.resolve(BookmarkService)
        try {
          const bm = await bmSvc.getUserBookmarkWithDetail(this.props.userId, bmId)
          if (!bm) throw BookmarkNotFoundError()

          const key = bm.bookmark.content_key
          if (!key) throw BookmarkContentNotFoundError()

          const content = await bmSvc.getBookmarkContent(key)
          if (!content) throw BookmarkContentNotFoundError()

          const document = ContentParser.getDocument(content)

          return {
            contents: [{ uri: uri.href, text: document.body.textContent || '' }]
          }
        } catch (e: unknown) {
          console.log(e)
          return {
            contents: [{ uri: uri.href, text: e instanceof Error ? e.message : 'Unknown error' }],
            isError: true
          }
        }
      }
    )

    this.server.resource('about', 'about://slax', async (uri: URL) => {
      return {
        contents: [{ uri: uri.href, text: aboutSlax }]
      }
    })

    this.server.prompt('slax', async () => {
      return {
        content: [{ type: 'text', text: aboutSlax }],
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: aboutSlax
            }
          }
        ]
      }
    })
  }

  private extractBookmarkId(uri: URL): number {
    const pathSegments = uri.pathname.split('/')
    const bookmarkId = pathSegments[pathSegments.length - 1]
    return parseInt(bookmarkId, 10)
  }
}
