import { loadScript } from '../../scripts/aem.js';

/**
 * Data storage - populated from JSON
 */
let coInnovationProcess = [];
let projects = [];

/**
 * Parse pipe-delimited string into array
 * @param {string} value - Pipe-delimited string
 * @returns {Array} Array of values
 */
function parseArray(value) {
  if (!value || value.trim() === '') return [];
  return value.split('|').map((item) => item.trim());
}

/**
 * Fetch and parse the co-innovation process data
 * @returns {Promise<Array>} Process steps
 */
async function fetchProcessData() {
  try {
    const response = await fetch('/data/co-innovation-process.json');
    const json = await response.json();

    return json.data.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      description: item.description,
      details: item.details,
      inputs: parseArray(item.inputs),
      outputs: parseArray(item.outputs),
      duration: item.duration || '',
      owner: item.owner || '',
      criteria: parseArray(item.criteria),
      outcomes: parseArray(item.outcomes),
      nextSteps: parseArray(item.nextSteps),
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load co-innovation process data:', error);
    return [];
  }
}

/**
 * Fetch and parse the projects data
 * @returns {Promise<Array>} Projects
 */
async function fetchProjectsData() {
  try {
    const response = await fetch('/data/projects.json');
    const json = await response.json();

    return json.data.map((item) => ({
      id: item.id,
      name: item.name,
      currentStage: item.currentStage,
      status: item.status,
      nextSteps: item.nextSteps,
      blockingReason: item.blockingReason || null,
      progress: parseInt(item.progress, 10) || 0,
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load projects data:', error);
    return [];
  }
}

/**
 * Get project counts per stage
 * @returns {Object} Object mapping stage id to count
 */
function getProjectCounts() {
  const counts = {};
  coInnovationProcess.forEach((step) => {
    counts[step.id] = projects.filter((p) => p.currentStage === step.id).length;
  });
  return counts;
}

/**
 * Get projects for a specific stage
 * @param {string} stageId - The stage ID
 * @returns {Array} Projects at that stage
 */
function getProjectsForStage(stageId) {
  return projects.filter((p) => p.currentStage === stageId);
}

/**
 * Get step by ID
 * @param {string} stepId - The step ID
 * @returns {Object} The step object
 */
function getStepById(stepId) {
  return coInnovationProcess.find((s) => s.id === stepId);
}

/**
 * Create the flowchart visualization using D3.js
 * @param {Element} container - The container element
 * @param {Function} onNodeClick - Callback when node is clicked
 */
function createFlowchart(container, onNodeClick) {
  // eslint-disable-next-line no-undef
  const { d3 } = window;
  const width = container.clientWidth || 1200;
  const height = 500;
  const nodeWidth = 160;
  const nodeHeight = 80;
  const horizontalGap = 40;
  const verticalGap = 100;
  const counts = getProjectCounts();

  // Clear existing content
  container.innerHTML = '';

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Add defs for markers and filters
  const defs = svg.append('defs');

  // Arrow marker
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#9CA3AF');

  // Drop shadow filter
  const filter = defs.append('filter')
    .attr('id', 'drop-shadow')
    .attr('height', '130%');
  filter.append('feGaussianBlur')
    .attr('in', 'SourceAlpha')
    .attr('stdDeviation', 3);
  filter.append('feOffset')
    .attr('dx', 0)
    .attr('dy', 2)
    .attr('result', 'offsetblur');
  filter.append('feComponentTransfer')
    .append('feFuncA')
    .attr('type', 'linear')
    .attr('slope', 0.2);
  const merge = filter.append('feMerge');
  merge.append('feMergeNode');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Calculate positions for 2-row layout (4 nodes per row)
  const row1StartX = (width - (4 * nodeWidth + 3 * horizontalGap)) / 2;
  const row1Y = 80;
  const row2Y = row1Y + nodeHeight + verticalGap;

  const positions = [
    // Row 1: Steps 1-4 (left to right)
    { x: row1StartX, y: row1Y },
    { x: row1StartX + nodeWidth + horizontalGap, y: row1Y },
    { x: row1StartX + 2 * (nodeWidth + horizontalGap), y: row1Y },
    { x: row1StartX + 3 * (nodeWidth + horizontalGap), y: row1Y },
    // Row 2: Steps 5-8 (right to left for flow)
    { x: row1StartX + 3 * (nodeWidth + horizontalGap), y: row2Y },
    { x: row1StartX + 2 * (nodeWidth + horizontalGap), y: row2Y },
    { x: row1StartX + nodeWidth + horizontalGap, y: row2Y },
    { x: row1StartX, y: row2Y },
  ];

  // Draw connections
  const connections = [
    { from: 0, to: 1, type: 'horizontal' },
    { from: 1, to: 2, type: 'horizontal' },
    { from: 2, to: 3, type: 'horizontal' },
    { from: 3, to: 4, type: 'vertical' },
    { from: 4, to: 5, type: 'horizontal-reverse' },
    { from: 5, to: 6, type: 'horizontal-reverse' },
    { from: 6, to: 7, type: 'horizontal-reverse' },
  ];

  // eslint-disable-next-line array-callback-return
  connections.map((conn) => {
    const fromPos = positions[conn.from];
    const toPos = positions[conn.to];
    let pathD;

    if (conn.type === 'horizontal') {
      const startX = fromPos.x + nodeWidth;
      const startY = fromPos.y + nodeHeight / 2;
      const endX = toPos.x;
      const endY = toPos.y + nodeHeight / 2;
      pathD = `M${startX},${startY} L${endX - 10},${endY}`;
    } else if (conn.type === 'horizontal-reverse') {
      const startX = fromPos.x;
      const startY = fromPos.y + nodeHeight / 2;
      const endX = toPos.x + nodeWidth;
      const endY = toPos.y + nodeHeight / 2;
      pathD = `M${startX},${startY} L${endX + 10},${endY}`;
    } else if (conn.type === 'vertical') {
      const startX = fromPos.x + nodeWidth / 2;
      const startY = fromPos.y + nodeHeight;
      const endX = toPos.x + nodeWidth / 2;
      const endY = toPos.y;
      pathD = `M${startX},${startY} L${endX},${endY - 10}`;
    }

    return svg.append('path')
      .attr('d', pathD)
      .attr('stroke', '#9CA3AF')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');
  });

  // Create node groups
  const nodes = svg.selectAll('.node')
    .data(coInnovationProcess)
    .enter()
    .append('g')
    .attr('class', (d) => `node node-${d.type}`)
    .attr('transform', (d, i) => `translate(${positions[i].x}, ${positions[i].y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      // Add click animation
      d3.select(event.currentTarget)
        .transition()
        .duration(100)
        .attr('transform', (data) => {
          const idx = coInnovationProcess.indexOf(data);
          return `translate(${positions[idx].x}, ${positions[idx].y}) scale(0.95)`;
        })
        .transition()
        .duration(100)
        .attr('transform', (data) => {
          const idx = coInnovationProcess.indexOf(data);
          return `translate(${positions[idx].x}, ${positions[idx].y}) scale(1)`;
        });
      onNodeClick(d);
    })
    .on('mouseenter', function handleMouseEnter() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', function getTransform() {
          const idx = coInnovationProcess.indexOf(d3.select(this).datum());
          return `translate(${positions[idx].x - 3}, ${positions[idx].y - 3}) scale(1.03)`;
        });
      d3.select(this).select('rect, polygon').attr('filter', 'url(#drop-shadow)');
    })
    .on('mouseleave', function handleMouseLeave() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', function getTransform() {
          const idx = coInnovationProcess.indexOf(d3.select(this).datum());
          return `translate(${positions[idx].x}, ${positions[idx].y})`;
        });
      d3.select(this).select('rect, polygon').attr('filter', null);
    });

  // Draw shapes based on type
  nodes.each(function drawNode(d) {
    const node = d3.select(this);

    if (d.type === 'step') {
      // Rectangle for steps
      node.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('class', 'node-shape');
    } else {
      // Diamond for gateways
      const halfW = nodeWidth / 2;
      const halfH = nodeHeight / 2;
      const points = [
        [halfW, 0],
        [nodeWidth, halfH],
        [halfW, nodeHeight],
        [0, halfH],
      ].map((p) => p.join(',')).join(' ');

      node.append('polygon')
        .attr('points', points)
        .attr('class', 'node-shape');
    }
  });

  // Add step numbers
  nodes.append('circle')
    .attr('cx', nodeWidth / 2)
    .attr('cy', -15)
    .attr('r', 18)
    .attr('class', 'step-number-circle');

  nodes.append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('class', 'step-number-text')
    .text((d, i) => i + 1);

  // Add titles
  nodes.append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', nodeHeight / 2 + 5)
    .attr('text-anchor', 'middle')
    .attr('class', 'node-title')
    .text((d) => d.title);

  // Add count badges
  nodes.each(function addBadge(d) {
    const count = counts[d.id];
    if (count > 0) {
      const node = d3.select(this);
      const badgeGroup = node.append('g')
        .attr('class', 'count-badge-group')
        .attr('transform', `translate(${nodeWidth - 15}, 8)`);

      badgeGroup.append('circle')
        .attr('r', 14)
        .attr('class', 'count-badge-circle');

      badgeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('class', 'count-badge-text')
        .text(count);
    }
  });
}

/**
 * Create mobile-friendly list view of process steps
 * @param {Element} container - The container element
 * @param {Function} onStepClick - Callback when step is clicked
 */
function createMobileList(container, onStepClick) {
  const counts = getProjectCounts();

  const list = document.createElement('div');
  list.className = 'co-innovation-mobile-list';

  coInnovationProcess.forEach((step, index) => {
    const count = counts[step.id] || 0;

    const stepEl = document.createElement('div');
    stepEl.className = `mobile-step ${step.type}`;
    stepEl.innerHTML = `
      <div class="mobile-step-number">${index + 1}</div>
      <div class="mobile-step-content">
        <div class="mobile-step-header">
          <h3 class="mobile-step-title">${step.title}</h3>
          <span class="mobile-step-badge">${step.type}</span>
        </div>
        <p class="mobile-step-desc">${step.description}</p>
        <div class="mobile-step-meta">
          ${count > 0 ? `<span class="mobile-step-count"><strong>${count}</strong> project${count !== 1 ? 's' : ''}</span>` : ''}
          ${step.duration ? `<span class="mobile-step-count">${step.duration}</span>` : ''}
        </div>
      </div>
      <span class="mobile-step-arrow">→</span>
    `;

    stepEl.addEventListener('click', () => onStepClick(step));
    list.append(stepEl);
  });

  container.append(list);
}

/**
 * Create the detail panel
 * @param {Element} block - The block element
 * @returns {Object} Panel elements and methods
 */
function createDetailPanel(block) {
  const panel = document.createElement('div');
  panel.className = 'co-innovation-panel';

  const panelHeader = document.createElement('div');
  panelHeader.className = 'co-innovation-panel-header';

  const panelHeaderTop = document.createElement('div');
  panelHeaderTop.className = 'co-innovation-panel-header-top';

  const panelTitleWrapper = document.createElement('div');
  const panelTitle = document.createElement('h2');
  panelTitle.className = 'co-innovation-panel-title';
  const panelBadge = document.createElement('span');
  panelBadge.className = 'co-innovation-type-badge';
  panelTitleWrapper.append(panelTitle, panelBadge);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'co-innovation-close-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '×';

  panelHeaderTop.append(panelTitleWrapper, closeBtn);
  panelHeader.append(panelHeaderTop);

  const panelContent = document.createElement('div');
  panelContent.className = 'co-innovation-panel-content';

  panel.append(panelHeader, panelContent);
  block.append(panel);

  return {
    panel,
    panelTitle,
    panelBadge,
    panelContent,
    closeBtn,
    show: () => {
      panel.classList.add('visible');
      block.classList.add('panel-open');
    },
    hide: () => {
      panel.classList.remove('visible');
      block.classList.remove('panel-open');
    },
  };
}

/**
 * Render step details in the panel
 * @param {Object} step - The step data
 * @param {Object} panelElements - Panel DOM elements
 * @param {Function} onNavigate - Navigation callback
 */
function renderStepDetails(step, panelElements, onNavigate) {
  const {
    panelTitle, panelBadge, panelContent,
  } = panelElements;

  const stageProjects = getProjectsForStage(step.id);
  const onTrackCount = stageProjects.filter((p) => p.status === 'on-track').length;
  const blockedCount = stageProjects.filter((p) => p.status === 'blocked').length;

  panelTitle.textContent = step.title;
  panelBadge.textContent = step.type;
  panelBadge.className = `co-innovation-type-badge ${step.type}`;

  let contentHTML = `
    <div class="co-innovation-section">
      <h3>Overview</h3>
      <p><strong>${step.description}</strong></p>
      <p>${step.details}</p>
    </div>
  `;

  if (step.type === 'step') {
    contentHTML += `
      <div class="co-innovation-section">
        <h3>Inputs</h3>
        <ul class="co-innovation-list">
          ${step.inputs.map((input) => `<li>${input}</li>`).join('')}
        </ul>
      </div>
      <div class="co-innovation-section">
        <h3>Outputs</h3>
        <ul class="co-innovation-list">
          ${step.outputs.map((output) => `<li>${output}</li>`).join('')}
        </ul>
      </div>
      <div class="co-innovation-info-grid">
        <div class="co-innovation-info-card">
          <div class="info-card-label">Duration</div>
          <div class="info-card-value">${step.duration}</div>
        </div>
        <div class="co-innovation-info-card">
          <div class="info-card-label">Owner</div>
          <div class="info-card-value">${step.owner}</div>
        </div>
      </div>
    `;
  } else {
    contentHTML += `
      <div class="co-innovation-section">
        <h3>Decision Criteria</h3>
        <ul class="co-innovation-list">
          ${step.criteria.map((criterion) => `<li>${criterion}</li>`).join('')}
        </ul>
      </div>
      <div class="co-innovation-section">
        <h3>Possible Outcomes</h3>
        <ul class="co-innovation-list">
          ${step.outcomes.map((outcome) => `<li>${outcome}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Navigation links (Bonus Feature)
  if (step.nextSteps && step.nextSteps.length > 0) {
    const navLinks = step.nextSteps.map((nextId) => {
      const nextStep = getStepById(nextId);
      return nextStep ? `<a href="#" class="nav-link" data-step-id="${nextId}">${nextStep.title}</a>` : '';
    }).filter(Boolean).join('');

    if (navLinks) {
      contentHTML += `
        <div class="co-innovation-section co-innovation-nav-section">
          <h3>Next Steps in Process</h3>
          <div class="co-innovation-nav-links">${navLinks}</div>
        </div>
      `;
    }
  }

  // Projects at This Stage section
  if (stageProjects.length > 0) {
    contentHTML += `
      <div class="co-innovation-section">
        <h3>Projects at This Stage</h3>
        <div class="co-innovation-projects-summary">
          <div class="projects-summary-item">
            <strong>Total:</strong> <span>${stageProjects.length}</span>
          </div>
          <div class="projects-summary-item">
            <span class="status-badge on-track">On-Track</span> <strong>${onTrackCount}</strong>
          </div>
          <div class="projects-summary-item">
            <span class="status-badge blocked">Blocked</span> <strong>${blockedCount}</strong>
          </div>
        </div>
        ${stageProjects.map((project) => `
          <div class="co-innovation-project-card ${project.status === 'blocked' ? 'blocked' : ''}">
            <div class="project-header">
              <p class="project-name">${project.name}</p>
              <span class="status-badge ${project.status}">${project.status === 'on-track' ? 'On-Track' : 'Blocked'}</span>
            </div>
            <div class="project-progress">
              <div class="progress-bar">
                <div class="progress-fill ${project.status}" style="width: ${project.progress}%"></div>
              </div>
              <span class="progress-text">${project.progress}%</span>
            </div>
            <div class="project-next-steps">
              <strong>Next Steps:</strong> ${project.nextSteps}
            </div>
            ${project.blockingReason ? `
              <div class="project-blocking-reason">
                <strong>Blocking Reason:</strong>
                ${project.blockingReason}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } else {
    contentHTML += `
      <div class="co-innovation-section">
        <h3>Projects at This Stage</h3>
        <p class="no-projects">No projects currently at this stage.</p>
      </div>
    `;
  }

  panelContent.innerHTML = contentHTML;

  // Add navigation link handlers
  panelContent.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const { stepId } = link.dataset;
      const targetStep = getStepById(stepId);
      if (targetStep) {
        onNavigate(targetStep);
      }
    });
  });
}

/**
 * Decorate the co-innovation block
 * @param {Element} block - The block element
 */
export default async function decorate(block) {
  // Load data from JSON
  [coInnovationProcess, projects] = await Promise.all([
    fetchProcessData(),
    fetchProjectsData(),
  ]);

  // Check if data loaded successfully
  if (coInnovationProcess.length === 0) {
    block.innerHTML = '<p class="error">Failed to load co-innovation process data.</p>';
    return;
  }

  // Load D3.js
  await loadScript('https://d3js.org/d3.v7.min.js');

  // Create main structure
  const header = document.createElement('div');
  header.className = 'co-innovation-header';
  header.innerHTML = `
    <h1>AEM Co-Innovation Process</h1>
    <p>From Idea to Impact</p>
  `;

  const chartContainer = document.createElement('div');
  chartContainer.className = 'co-innovation-chart-container';

  const chartTitle = document.createElement('div');
  chartTitle.className = 'co-innovation-chart-title';
  chartTitle.innerHTML = `
    <h2>Co-Innovation Journey</h2>
    <p class="subtitle">8-Step Process from Discovery to Delivery</p>
  `;

  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'co-innovation-chart';

  chartContainer.append(chartTitle, chartWrapper);

  // Clear block and add new structure
  block.textContent = '';
  block.append(header, chartContainer);

  // Create detail panel
  const panelElements = createDetailPanel(block);

  // Handle node click
  const handleNodeClick = (step) => {
    renderStepDetails(step, panelElements, handleNodeClick);
    panelElements.show();
  };

  // Handle close
  panelElements.closeBtn.addEventListener('click', () => {
    panelElements.hide();
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelElements.panel.classList.contains('visible')) {
      panelElements.hide();
    }
  });

  // Close on click outside (on the overlay)
  block.addEventListener('click', (e) => {
    if (e.target === block && panelElements.panel.classList.contains('visible')) {
      panelElements.hide();
    }
  });

  // Create the flowchart (desktop)
  createFlowchart(chartWrapper, handleNodeClick);

  // Create mobile list view
  createMobileList(chartContainer, handleNodeClick);

  // Handle resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      createFlowchart(chartWrapper, handleNodeClick);
    }, 250);
  });
}
