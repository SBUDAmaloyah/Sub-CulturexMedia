// Fictional teams and players so nobody mistakes this for real results.
const mn = (off, len) => ((Math.floor(Date.now() / 60000) + off) % len) + 1;
module.exports = function demo(sport) {
  const d = {
    soccer: [
      { league: 'Premier Division', home: 'Rovers Athletic', away: 'Kingsbridge Town', hs: 1, as: 1, status: 'LIVE', clock: mn(7, 90) + "'" },
      { league: 'Premier Division', home: 'Northfield Wanderers', away: 'Lakeside FC', hs: 0, as: 2, status: 'LIVE', clock: mn(41, 90) + "'" },
      { league: 'Premier Division', home: 'Harbour City FC', away: 'Eastgate United', hs: 2, as: 1, status: 'FT' },
      { league: 'Cup', home: 'Redstone Albion', away: 'Port Vale City', status: 'UP', time: '20:45' },
    ],
    rugby: [
      { league: 'Super League', home: 'Valley Bulls', away: 'Coastal Sharks', hs: 13, as: 10, status: 'LIVE', clock: mn(12, 80) + "'" },
      { league: 'Super League', home: 'Capital Lions', away: 'Royal Park Rams', hs: 27, as: 24, status: 'FT' },
      { league: 'Super League', home: 'Highland Stags', away: 'Bay Raiders', status: 'UP', time: '18:30' },
    ],
    cricket: [
      { league: 'ODI Series', home: 'Southern Strikers', away: 'Northern Rhinos', hs: '312/6 (50)', as: '214/4 (38.2)', status: 'LIVE', clock: '2nd inns', note: 'Rhinos need 99 runs from 71 balls' },
      { league: 'T20 Cup', home: 'Metro Mavericks', away: 'Coast Kings', hs: '168/7', as: '171/3', status: 'FT', note: 'Coast Kings won by 7 wickets' },
      { league: 'T20 Cup', home: 'Desert Vipers', away: 'Island Hawks', status: 'UP', time: '19:00' },
    ],
    basketball: [
      { league: 'National League', home: 'Capital Cranes', away: 'Bayside Blaze', hs: 78, as: 81, status: 'LIVE', clock: 'Q3 ' + String(mn(3, 12) - 1).padStart(2, '0') + ':' + String(mn(9, 59)).padStart(2, '0') },
      { league: 'National League', home: 'Metro Hoops', away: 'Summit Wolves', hs: 104, as: 99, status: 'FT' },
      { league: 'National League', home: 'Iron Foxes', away: 'Lakeshore Kings', status: 'UP', time: '21:00' },
    ],
    golf: { event: 'Lakeside Open', status: 'Round 3 - in progress', rows: [['T1', 'Mia Hartmann', '-14', 'F'], ['T1', 'Jonas Eriksen', '-14', '16'], ['3', 'Kofi Mensah', '-12', 'F'], ['4', 'Alberto Navas', '-11', '15'], ['T5', 'Priya Nair', '-10', 'F'], ['T5', 'Liam O\u2019Connell', '-10', '17'], ['7', 'Sofia Lindqvist', '-9', '14'], ['8', 'Kenji Arai', '-8', 'F'], ['T9', 'Tom Whitfield', '-7', '18'], ['T9', 'Amara Diallo', '-7', '13']] },
    f1: { event: 'Coastal Grand Prix', status: 'Race - lap ' + mn(5, 57) + '/57', rows: [['1', 'Mateo Rinaldi', 'Veloce Racing', 'Leader'], ['2', 'Oskar Lindgren', 'Nordic GP', '+1.9s'], ['3', 'Hana Ito', 'Veloce Racing', '+4.2s'], ['4', 'Diego Alvarez', 'Sol Motorsport', '+9.8s'], ['5', 'Priya Raman', 'Apex Dynamics', '+12.4s'], ['6', 'Luca Bernard', 'Nordic GP', '+15.0s'], ['7', 'Tariq Haddad', 'Sol Motorsport', '+21.3s'], ['8', 'Eva Novak', 'Apex Dynamics', '+24.7s'], ['9', 'Sam Whitlock', 'Crown Racing', '+31.1s'], ['10', 'Yuki Tanabe', 'Crown Racing', '+33.6s']] },
  };
  return d[sport];
};
