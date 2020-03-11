import * as d3 from "d3";
import _ from "lodash";
import inflation from "us-inflation";
import textures from "textures";
import { legendColor } from "d3-svg-legend";
import { annotation, annotationLabel } from "d3-svg-annotation";

const startYear = 2008;
const numYears = 10;
// colors (purple, green, pink)
const genreColors = ["#e683b4", "#53c3ac", "#8475e8"];
const holidayColors = {
  summer: "#eb6a5b",
  winter: "#51aae8"
};
// load movies data
let movies = require("./movies.json");

// set up SVG
const width = 1200;
const height = 300;
const margin = { top: 20, right: 20, bottom: 20, left: 40 };
const svg = d3
  .select("#app")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("overflow", "visible");

// set up animation transition
const t = d3.transition().duration(1500);
/*******************************************
 * Process movie data
 *******************************************/
movies = _
  .chain(movies)
  .map(d => {
    const year = +d.Year;
    const date = new Date(d.Released);
    const boxOffice = parseInt(d.BoxOffice.replace(/[\$\,]/g, ""));
    return {
      title: d.Title,
      date,
      boxOffice: boxOffice && inflation({ year, amount: boxOffice }),
      genre: d.Genre.split(", ")[0],
      year
    };
  })
  .filter(d => d.boxOffice && d.year >= startYear)
  .value();

// mean box office figure, top 3 genres
const meanBox = d3.mean(movies, d => d.boxOffice);
const genres = _.chain(movies)
  .countBy('genre')
  .toPairs()
  .sortBy(d => -d[1])
  .take(3)
  .map(0)
  .value()
console.log(genres)

// scale: x, y, colors
// x-scale, time scale
const [minDate, maxDate] = d3.extent(movies, d => d.date)
const xScale = d3.scaleTime()
  .domain([
    d3.timeYear.floor(minDate),
    d3.timeYear.ceil(maxDate),
  ]).range([margin.left, width - margin.right])
  console.log(xScale.domain(), xScale.range());

const boxExtent = d3.extent(movies, d => d.boxOffice - meanBox)
const yScale = d3.scaleLinear()
  .domain(boxExtent).range([height - margin.bottom, margin.top])
  console.log(yScale.domain(), yScale.range())

const colorScale = d3.scaleOrdinal()
  .domain(genres)
  .range(genreColors)

const areaGen = d3.area()
  .x(d => xScale(d.date))
  .y1(d => yScale(d.val))
  .y0(d => yScale(0))
  .curve(d3.curveCatmullRom)

/*******************************************
 * Set up defs for drop-shadow and mask
 *******************************************/
const defs = svg.append("defs");
// dropshadow, got quite a bit of help from:
// https://github.com/nbremer/babyspikelivecoding/blob/master/js/filter.js
const drop = defs.append("filter").attr("id", "shadow");
// add color matrix to soften the opacity
drop
  .append("feColorMatrix")
  .attr("type", "matrix")
  .attr(
    "values",
    `
    0 0 0 0 0
    0 0 0 0 0
    0 0 0 0 0
    0 0 0 0.3 0
    `
  );
// add a blur to the color matrix
drop
  .append("feGaussianBlur")
  .attr("stdDeviation", 3)
  .attr("result", "coloredBlur");
// now merge the colored blur with the source graphic
const feMerge = drop.append("feMerge");
feMerge.append("feMergeNode").attr("in", "coloredBlur");
feMerge.append("feMergeNode").attr("in", "SourceGraphic");

// draw curves
const curves = svg.selectAll('path.curve')
  .data(movies)
  .enter()
  .append('path')
  .classed('curve', true)
  .attr('d', d => areaGen([
    {date: d3.timeMonth.offset(d.date, -2), val: 0},
    {date: d.date, val: d.boxOffice - meanBox},
    {date: d3.timeMonth.offset(d.date, 2), val: 0}
  ])).attr('fill', d => colorScale(d.genre))
  .attr("fill-opacity","0.75")
  // .attr('stroke', '#fff')
  .style('filter', 'url(#shadow)')

// add axes
const xAxis = d3.axisBottom()
  .scale(xScale)
const yAxis = d3.axisLeft()
  .scale(yScale)
  .tickFormat(d => '$' + parseInt((d + meanBox) / 1000000) + 'M')

svg.append('g')
  .classed('x-axis', true)
  .attr('transform', `translate(0, ${yScale(0)})`)
  .call(xAxis)
svg.append('g')
  .classed('y-axis', true)
  .attr('transform', `translate(${margin.left}, 0)`)
  .call(yAxis)
  .select('.domain')
  .remove()

const annotationData = _.chain(movies)
  .filter(d => (d.boxOffice - meanBox) > 200000000)
  // note (title), x/y, dx/dy
  .map(d => {
    return {
      note: {title: d.title, align:"middle",
      orientation:"leftRight"},
      x: xScale(d.date),
      y: yScale(d.boxOffice - meanBox),
      dx: 20,
      dy: 0
    }
  })
  .value()

const makeAnnotations = annotation()
  .type(annotationLabel)
  .annotations(annotationData)

svg.append('g')
  .call(makeAnnotations)

console.log(annotationData)


/*******************************************
 * Calculate holidays and draw textures
 *******************************************/
const holidayData = _
  .chain(numYears)
  .times(i => {
    return [
      {
        type: "summer",
        dates: [
          new Date(`6/1/${startYear + i}`),
          new Date(`8/30/${startYear + i}`)
        ]
      },
      {
        type: "winter",
        dates: [
          new Date(`11/1/${startYear + i}`),
          new Date(`12/31/${startYear + i}`)
        ]
      }
    ];
  })
  .flatten()
  .value();
// and draw them as textures
const summer = textures
  .lines()
  .lighter()
  .size(8)
  .stroke("#eb6a5b");
const winter = textures
  .lines()
  .lighter()
  .size(8)
  .stroke("#51aae8");
svg.call(summer);
svg.call(winter);
const holidays = svg.insert("g", ".curves");
holidays
  .selectAll(".summer")
  .data(holidayData)
  .enter()
  .append("rect")
  .attr("x", d => xScale(d.dates[0]))
  .attr("y", margin.top)
  .attr("width", d => xScale(d.dates[1]) - xScale(d.dates[0]))
  .attr("height", height - margin.top - margin.bottom)
  .attr("fill", d => (d.type === "summer" ? summer.url() : winter.url()));

/*******************************************
 * Draw legends
 *******************************************/
const legend = legendColor().scale(colorScale);
const legendG = svg
  .append("g")
  .classed("legend", true)
  .attr("transform", `translate(${width - margin.right}, ${margin.top})`)
  .call(legend);
legendG
  .selectAll("text")
  .attr("font-size", 12)
  .attr("font-family", "Helvetica")
  .attr("fill", "#000");


