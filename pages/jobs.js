import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Jobs.module.css';

const RECENT_DAYS = 15;

function isRecent(dateStr) {
  if (!dateStr) return false;
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  return days <= RECENT_DAYS;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  return days === 0;
}

function daysAgoLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.floor(days / 7)} weeks ago`;
}

function JobsTable({ jobs }) {
  if (!jobs || jobs.length === 0) return <div className={styles.noJobs}>No recent job openings found.</div>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Job Title</th>
          <th>Location</th>
          <th>Posted</th>
          <th>Source</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job, i) => (
          <tr key={job.id} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
            <td className={styles.jobTitle}>{job.title}</td>
            <td className={styles.jobLoc}>{job.location}</td>
            <td>
              <span className={job.postedAgo === 'Today' ? styles.badgeNew : styles.badgeOld}>
                {job.postedAgo}
              </span>
            </td>
            <td>
              <span className={job.source === 'Apollo' ? styles.badgeApollo : styles.badgeScrape}>
                {job.source}
              </span>
            </td>
            <td>
              {job.url
                ? <a href={job.url} target="_blank" rel="noopener noreferrer" className={styles.viewLink}>View →</a>
                : <span className={styles.noLink}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Jobs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const fetchData = async (force = false) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(force ? '/api/jobs-data?refresh=true' : '/api/jobs-data');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // Tag each job with postedAgo and filter flags
      const clients = json.clients.map(c => ({
        ...c,
        jobs: (c.jobs || []).map(j => ({
          ...j,
          postedAgo: daysAgoLabel(j.postedAt),
          isRecent: isRecent(j.postedAt),
          isToday: isToday(j.postedAt),
        })),
      }));
      setData({ ...json, clients });
      const exp = {};
      clients.forEach(c => { exp[c.domain] = true; });
      setExpanded(exp);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = domain => setExpanded(e => ({ ...e, [domain]: !e[domain] }));

  if (!data && loading) return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>S</div>
        <div><div className={styles.headerTitle}>scalearmy</div><div className={styles.headerSub}>Client Job Openings Monitor</div></div>
      </header>
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <div className={styles.loadingTitle}>Fetching job postings...</div>
        <div className={styles.loadingNote}>Checking Apollo for all clients. This takes 30–60 seconds.</div>
      </div>
    </div>
  );

  // Compute tab data
  const allClients = data?.clients || [];
  const recentClients = allClients.map(c => ({ ...c, jobs: c.jobs.filter(j => j.isRecent) })).filter(c => c.jobs.length > 0);
  const todayClients = allClients.map(c => ({ ...c, jobs: c.jobs.filter(j => j.isToday) })).filter(c => c.jobs.length > 0);

  const totalOpenRoles = allClients.reduce((s, c) => s + (c.totalJobs || 0), 0);
  const recentRoles = recentClients.reduce((s, c) => s + c.jobs.length, 0);
  const todayRoles = todayClients.reduce((s, c) => s + c.jobs.length, 0);

  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  // Filter by search
  const filterBySearch = clients => clients.map(c => ({
    ...c,
    jobs: c.jobs.filter(j =>
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.location || '').toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(c => !search || c.jobs.length > 0 || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <Head>
        <title>Scale Army — Client Job Openings</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.logo}>S</div>
          <div>
            <div className={styles.headerTitle}>scalearmy</div>
            <div className={styles.headerSub}>Client Job Openings Monitor</div>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.fetchedAt}>
              {data?.fromCache ? `Cached · last fetched ${fetchedAt}` : `Live · fetched ${fetchedAt}`}
            </span>
            <button className={styles.refreshBtn} onClick={() => fetchData(true)} disabled={loading}>
              {loading ? '...' : '↻ Refresh now'}
            </button>
          </div>
        </header>

        <main className={styles.main}>
          {error && <div className={styles.errorBox}>⚠️ {error}</div>}

          {/* Stats */}
          <div className={styles.statsBar}>
            <div className={styles.stat}>
              <div className={styles.statVal}>{allClients.length}</div>
              <div className={styles.statLbl}>Clients monitored</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <div className={styles.statVal}>{totalOpenRoles}</div>
              <div className={styles.statLbl}>Total open roles</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <div className={styles.statVal} style={{ color: '#ff6432' }}>{recentRoles}</div>
              <div className={styles.statLbl}>Posted last 15 days</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <div className={styles.statVal} style={{ color: '#00916e' }}>{todayRoles}</div>
              <div className={styles.statLbl}>Found today</div>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`} onClick={() => setActiveTab('all')}>
              All Companies <span className={styles.tabCount}>{allClients.length}</span>
            </button>
            <button className={`${styles.tab} ${activeTab === 'recent' ? styles.tabActive : ''}`} onClick={() => setActiveTab('recent')}>
              Recent Openings <span className={styles.tabCount}>{recentRoles}</span>
            </button>
            <button className={`${styles.tab} ${activeTab === 'today' ? styles.tabActive : ''}`} onClick={() => setActiveTab('today')}>
              Found Today <span className={styles.tabCount}>{todayRoles}</span>
            </button>
          </div>

          <div className={styles.tabContent}>

            {/* TAB 1: All Companies — summary table */}
            {activeTab === 'all' && (
              <div className={styles.summaryWrap}>
                <table className={styles.summaryTable}>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Domain</th>
                      <th style={{ textAlign: 'center' }}>Open Roles</th>
                      <th style={{ textAlign: 'center' }}>Recent (15 days)</th>
                      <th style={{ textAlign: 'center' }}>Found Today</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allClients.map((c, i) => {
                      const recentCount = c.jobs.filter(j => j.isRecent).length;
                      const todayCount = c.jobs.filter(j => j.isToday).length;
                      return (
                        <tr key={c.domain} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                          <td className={styles.summaryName}>{c.name}</td>
                          <td className={styles.summaryDomain}>{c.domain}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={c.totalJobs > 0 ? styles.countBadge : styles.countBadgeZero}>{c.totalJobs || 0}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {recentCount > 0 ? <span className={styles.countBadgeOrange}>{recentCount}</span> : <span className={styles.dash}>—</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {todayCount > 0 ? <span className={styles.countBadgeGreen}>{todayCount}</span> : <span className={styles.dash}>—</span>}
                          </td>
                          <td>
                            {c.error
                              ? <span className={styles.statusError}>Not found</span>
                              : todayCount > 0
                              ? <span className={styles.statusNew}>New today</span>
                              : recentCount > 0
                              ? <span className={styles.statusRecent}>Hiring</span>
                              : <span className={styles.statusQuiet}>Quiet</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Recent Openings — jobs posted in last 15 days */}
            {activeTab === 'recent' && (
              <div>
                <div className={styles.tabNote}>Showing jobs posted within the last {RECENT_DAYS} days across {recentClients.length} client{recentClients.length !== 1 ? 's' : ''}</div>
                <input className={styles.search} placeholder="Search by company, title, or location..." value={search} onChange={e => setSearch(e.target.value)} />
                {filterBySearch(recentClients).map(client => (
                  <div key={client.domain} className={styles.clientCard}>
                    <div className={styles.clientHeader} onClick={() => toggleExpand(client.domain)}>
                      <div className={styles.clientLeft}>
                        <div className={styles.clientName}>{client.name}</div>
                        <div className={styles.clientDomain}>{client.domain}</div>
                      </div>
                      <div className={styles.clientRight}>
                        <span className={styles.jobCount}>{client.jobs.length} recent role{client.jobs.length !== 1 ? 's' : ''}</span>
                        {client.linkedinUrl && <a href={client.linkedinUrl} target="_blank" rel="noopener noreferrer" className={styles.liLink} onClick={e => e.stopPropagation()}>LinkedIn →</a>}
                        <span className={styles.chevron}>{expanded[client.domain] ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {expanded[client.domain] && (
                      <div className={styles.jobsWrap}><JobsTable jobs={client.jobs} /></div>
                    )}
                  </div>
                ))}
                {recentClients.length === 0 && <div className={styles.emptyState}>No job openings found within the last {RECENT_DAYS} days.</div>}
              </div>
            )}

            {/* TAB 3: Found Today */}
            {activeTab === 'today' && (
              <div>
                <div className={styles.tabNote}>Jobs discovered in today's search run across {todayClients.length} client{todayClients.length !== 1 ? 's' : ''}</div>
                <input className={styles.search} placeholder="Search by company, title, or location..." value={search} onChange={e => setSearch(e.target.value)} />
                {filterBySearch(todayClients).map(client => (
                  <div key={client.domain} className={styles.clientCard}>
                    <div className={styles.clientHeader} onClick={() => toggleExpand(client.domain)}>
                      <div className={styles.clientLeft}>
                        <div className={styles.clientName}>{client.name}</div>
                        <div className={styles.clientDomain}>{client.domain}</div>
                      </div>
                      <div className={styles.clientRight}>
                        <span className={styles.jobCountGreen}>{client.jobs.length} found today</span>
                        {client.linkedinUrl && <a href={client.linkedinUrl} target="_blank" rel="noopener noreferrer" className={styles.liLink} onClick={e => e.stopPropagation()}>LinkedIn →</a>}
                        <span className={styles.chevron}>{expanded[client.domain] ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {expanded[client.domain] && (
                      <div className={styles.jobsWrap}><JobsTable jobs={client.jobs} /></div>
                    )}
                  </div>
                ))}
                {todayClients.length === 0 && <div className={styles.emptyState}>No jobs found in today's search yet. Try refreshing later.</div>}
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}
