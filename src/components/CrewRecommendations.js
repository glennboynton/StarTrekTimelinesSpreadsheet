import React from 'react';
import { Image } from 'office-ui-fabric-react/lib/Image';

import { CrewList } from './CrewList.js';
import { CollapsibleSection } from './CollapsibleSection.js';
import { ItemDisplay } from './ItemDisplay';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

export class GuaranteedSuccess extends React.Component {
	render() {
		return (<CollapsibleSection title={this.props.title}>
			{STTApi.missionSuccess.map(function (recommendation) {
				if (recommendation.cadet != this.props.cadet) {
					return <span key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name} />;
				}

				if (recommendation.crew.length == 0) {
					return (<div key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}>
						<h3>{recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}</h3>
						<span style={{ color: 'red' }}>No crew can complete this challenge!</span><br />
						<span className='quest-mastery'>You need a crew with the <Image src={CONFIG.SPRITES['icon_' + recommendation.skill].url} height={18} /> {CONFIG.SKILLS[recommendation.skill]} skill of at least {recommendation.roll}
							{(recommendation.lockedTraits.length > 0) &&
								(<span>&nbsp;and one of these skills: {recommendation.lockedTraits.map(function (trait) { return (<span key={trait}>{STTApi.getTraitName(trait)}</span>); }.bind(this)).reduce((prev, curr) => [prev, ', ', curr])}
								</span>)}.</span>
					</div>);
				}

				if (recommendation.crew.filter(function (crew) { return crew.success > 99.9; }).length == 0) {
					return (<div key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}>
						<h3>{recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}</h3>
						<span>Your best bet is {recommendation.crew[0].crew.name} with a {recommendation.crew[0].success.toFixed(2)}% success chance.</span><br />
						<span className='quest-mastery'>You need a crew with the <Image src={CONFIG.SPRITES['icon_' + recommendation.skill].url} height={18} /> {CONFIG.SKILLS[recommendation.skill]} skill of at least {recommendation.roll}
							{(recommendation.lockedTraits.length > 0) &&
								(<span>&nbsp;and one of these skills: {recommendation.lockedTraits.map(function (trait) { return (<span key={trait}>{STTApi.getTraitName(trait)}</span>); }.bind(this)).reduce((prev, curr) => [prev, ', ', curr])}
								</span>)}.</span>
					</div>);
				}
			}.bind(this))
			}</CollapsibleSection>);
	}
}

export class CrewDuplicates extends React.Component {
	constructor(props) {
		super(props);

		var uniq = STTApi.roster.map((crew) => { return { count: 1, crewId: crew.id }; })
			.reduce((a, b) => {
				a[b.crewId] = (a[b.crewId] || 0) + b.count;
				return a;
			}, {});

		var duplicateIds = Object.keys(uniq).filter((a) => uniq[a] > 1);

		this.state = {
			duplicates: STTApi.roster.filter(function (crew) { return duplicateIds.includes(crew.id.toString()); })
		};
	}

	render() {
		if (this.state.duplicates.length > 0) {
			return (<CollapsibleSection title={this.props.title}>
				<CrewList data={this.state.duplicates} grouped={false} sortColumn='name' overrideClassName='embedded-crew-grid' />
			</CollapsibleSection>);
		}
		else {
			return <span />;
		}
	}
}

export class MinimalComplement extends React.Component {
	constructor(props) {
		super(props);

		if (!STTApi.minimalComplement) {
			// The thread (worker) didn't finish loading yet
			this.state = {
				dataLoaded: false
			};
		}
		else {
			this.state = {
				dataLoaded: true,
				removableCrew: STTApi.roster.filter(function (crew) { return STTApi.minimalComplement.unneededCrew.includes(crew.id) && (crew.frozen == 0); }),
				unfreezeCrew: STTApi.roster.filter(function (crew) { return STTApi.minimalComplement.neededCrew.includes(crew.id) && (crew.frozen > 0); })
			};
		}
	}

	render() {
		if (this.state.dataLoaded) {
			return (<CollapsibleSection title={this.props.title}>
				<div>
					<p><b>Note:</b> These recommendations do not take into account the needs for gauntlets, shuttle adventures, voyages or any ship battle missions. They also don't account for quest paths, only considering the needs of individual nodes. Manually review each one before making decisions.</p>

					<h3>Crew which could be frozen or airlocked</h3>
					<CrewList data={this.state.removableCrew} grouped={false} overrideClassName='embedded-crew-grid' />
					<h3>Crew which needs to be unfrozen</h3>
					<CrewList data={this.state.unfreezeCrew} grouped={false} overrideClassName='embedded-crew-grid' />
				</div>
			</CollapsibleSection>);
		}
		else {
			return <p>Minimal crew calculation not done yet. Reload this tab in a bit.</p>
		}
	}
}

export class NeededEquipment extends React.Component {
	constructor(props) {
		super(props);

		let unparsedEquipment = [];
		STTApi.roster.forEach((crew) => crew.equipment_slots.forEach((equipment) => {
			if (!equipment.have) {
				unparsedEquipment.push(equipment.archetype);
			}
		}));

		let mapUnowned = {};
		while (unparsedEquipment.length > 0) {
			let archetype = unparsedEquipment.pop();
			let equipment = STTApi.itemArchetypeCache.archetypes.find(e => e.id === archetype);

			if (equipment.recipe && equipment.recipe.demands && (equipment.recipe.demands.length > 0)) {
				// Let's add all children in the recipe, so that we can parse them on the next loop iteration
				equipment.recipe.demands.forEach((item) => unparsedEquipment.push(item.archetype_id));
			} else if (equipment.item_sources && (equipment.item_sources.length > 0)) {
				let found = mapUnowned[archetype];
				if (found) {
					found.needed++;
				} else {
					mapUnowned[archetype] = {equipment, needed: 1};
				}
			} else {
				console.error(`This equipment has no recipe and no sources: '${equipment.name}'`);
			}
		}

		// Sort the map by "needed" descending
		let arr = Object.values(mapUnowned);
		arr.sort((a,b) => b.needed - a.needed);

		this.state = {
			neededEquipment: arr
		};
	}

	renderSources(equipment) {
		let disputeMissions = equipment.item_sources.filter(e => e.type === 0);
		let missions = equipment.item_sources.filter(e => e.type === 2);
		let factions = equipment.item_sources.filter(e => e.type === 1);

		let res = [];

		if (disputeMissions.length > 0) {
			res.push(<div key={'disputeMissions'}>
				<b>Dispute missions: </b>
				{disputeMissions.map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span> ({entry.chance_grade} / 5)</span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if (missions.length > 0) {
			res.push(<div key={'missions'}>
				<b>Missions: </b>
				{missions.map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span> ({entry.chance_grade} / 5)</span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if (factions.length > 0) {
			res.push(<p key={'factions'}>
				<b>Faction missions: </b>
				{factions.map((entry, idx) =>
					`${entry.name} (${entry.chance_grade} / 5)`
				).join(', ')}
			</p>)
		}

		return <div>{res}</div>;
	}

	render() {
		if (this.state.neededEquipment) {
			return (<CollapsibleSection title={this.props.title}>
				<p>Equipment required to fill all open slots for all crew currently in your roster.</p>
				{this.state.neededEquipment.map((entry, idx) =>
					<div key={idx} style={{ display: 'grid', gridTemplateColumns: '128px auto', gridTemplateAreas:`'icon name' 'icon details'` }}>
						<div style={{ gridArea: 'icon'}}><ItemDisplay src={entry.equipment.iconUrl} size={128} maxRarity={entry.equipment.rarity} rarity={entry.equipment.rarity} /></div>
						<h4 style={{ gridArea: 'name', alignSelf: 'start', margin:'0' }}>{entry.equipment.name} ({entry.needed})</h4>
						<div style={{ gridArea: 'details', alignSelf: 'start' }}>
							{this.renderSources(entry.equipment)}
						</div>
					</div>
				)}
			</CollapsibleSection>);
		}
		else {
			return <span />;
		}
	}
}

export class CrewRecommendations extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showDetails: false
		};
	}

	render() {
		return (
			<div className='tab-panel' data-is-scrollable='true'>
				<GuaranteedSuccess title='Cadet challenges without guaranteed success' cadet={true} />
				<GuaranteedSuccess title='Missions without guaranteed success' cadet={false} />
				<CrewDuplicates title='Crew duplicates' />
				<MinimalComplement title='Minimal crew complement needed for cadet challenges' />
				<NeededEquipment title='Needed equipment' />
			</div>
		);
	}
}