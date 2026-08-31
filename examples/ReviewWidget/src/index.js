/**
 * ReviewWidget — reference plugin built with @belanjaku/plugin-sdk.
 * `npm run build` produces dist/index.js + dist/manifest.json — zip dist/
 * and upload that to plugin-service. See ../../docs/getting-started.md.
 */
import {
  createPlugin,
  getPluginContext,
  getPublicPluginData,
  submitPluginData,
  escapeHtml,
} from '@belanjaku/plugin-sdk';

function renderSummary(container, reviews, theme) {
  const avg =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (Number(r.payload?.rating) || 0), 0) / reviews.length).toFixed(1)
      : '-';

  container.innerHTML = `
    <div style="font-family:${theme.fontFamily};color:${theme.textColor};padding:12px 0">
      <strong style="font-size:1.4em;color:${theme.primaryColor}">★ ${avg}</strong>
      <span style="margin-left:8px;font-size:0.9em">${reviews.length} reviews</span>
    </div>
  `;
}

function renderComments(container, reviews, ctx, theme, graphqlOptions) {
  const list = reviews
    .map(
      (r) => `
        <div style="border-bottom:1px solid #eee;padding:10px 0">
          <div>
            <strong>${escapeHtml(r.payload?.name ?? 'Anonymous')}</strong>
            <span style="color:${theme.primaryColor};margin-left:8px">
              ${'★'.repeat(Number(r.payload?.rating) || 0)}
            </span>
          </div>
          <p style="margin:4px 0 0;color:${theme.textColor}">${escapeHtml(r.payload?.comment ?? '')}</p>
        </div>
      `
    )
    .join('');

  const form = `
    <form id="review-form" style="margin-top:16px">
      <h4 style="margin:0 0 8px;color:${theme.primaryColor}">Write a review</h4>
      <div style="margin-bottom:8px">
        <label style="display:block;margin-bottom:4px">Rating</label>
        <select id="review-rating" style="padding:6px;border-radius:${theme.buttonRadius};border:1px solid #ccc">
          ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} ★</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:8px">
        <label style="display:block;margin-bottom:4px">Name</label>
        <input id="review-name" type="text" placeholder="Your name"
          style="width:100%;padding:6px;border-radius:${theme.buttonRadius};border:1px solid #ccc;box-sizing:border-box" />
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px">Review</label>
        <textarea id="review-comment" rows="3" placeholder="Tell us about your experience..."
          style="width:100%;padding:6px;border-radius:${theme.buttonRadius};border:1px solid #ccc;box-sizing:border-box"></textarea>
      </div>
      <button type="submit"
        style="background:${theme.buttonBackgroundColor};color:${theme.buttonTextColor};
               border:none;padding:8px 20px;border-radius:${theme.buttonRadius};cursor:pointer">
        Submit review
      </button>
      <span id="review-msg" style="margin-left:12px;font-size:0.85em"></span>
    </form>
  `;

  container.innerHTML = `
    <div style="font-family:${theme.fontFamily};color:${theme.textColor}">
      <div id="review-list">${list || '<p style="color:#999">No reviews yet.</p>'}</div>
      ${form}
    </div>
  `;

  const formEl = container.querySelector('#review-form');
  const msgEl = container.querySelector('#review-msg');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rating = parseInt(container.querySelector('#review-rating').value, 10);
    const name = container.querySelector('#review-name').value.trim();
    const comment = container.querySelector('#review-comment').value.trim();

    if (!name || !comment) {
      msgEl.textContent = 'Name and review are required.';
      return;
    }

    msgEl.textContent = 'Submitting...';
    try {
      await submitPluginData(
        {
          runtime_key: ctx.runtimeKey,
          scope_type: 'product',
          scope_key: ctx.scopeKey,
          seller_key: ctx.sellerKey,
          payload: { rating, name, comment },
        },
        graphqlOptions
      );
      msgEl.textContent = 'Thanks for your review!';
      formEl.reset();
    } catch (err) {
      console.error('[ReviewWidget] Submit failed:', err);
      msgEl.textContent = 'Failed to submit review. Please try again.';
    }
  };

  formEl.addEventListener('submit', handleSubmit);

  return () => {
    formEl.removeEventListener('submit', handleSubmit);
    container.innerHTML = '';
  };
}

createPlugin('ReviewWidget', {
  async setup(props, container) {
    const ctx = getPluginContext(props);
    const graphqlOptions = {
      tenantDomain: ctx.tenantDomain,
      runtimeKey: ctx.runtimeKey,
      apiUrl: ctx.apiUrl,
    };
    const theme = props.theme;

    let reviews = [];
    try {
      reviews = await getPublicPluginData(
        { runtime_key: ctx.runtimeKey, scope_type: 'product', scope_key: ctx.scopeKey },
        graphqlOptions
      );
    } catch (err) {
      console.error('[ReviewWidget] Failed to load reviews:', err);
    }

    const slot = props.slot || 'summary';
    if (slot === 'summary') {
      renderSummary(container, reviews, theme);
      return () => {
        container.innerHTML = '';
      };
    }

    return renderComments(container, reviews, ctx, theme, graphqlOptions);
  },
});
